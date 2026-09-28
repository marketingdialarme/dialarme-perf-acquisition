/* ------------------------------------------------------------------
   api/data.js
   Lit les leads dans Airtable et les dépenses dans Windsor.ai,
   répartit tout en trois cohortes et calcule le funnel.
   Les clés restent côté serveur : rien ne transite par le navigateur.
   ------------------------------------------------------------------ */

const BASE = "appZ0mGFLQzv6P9Vx";
const TABLE_LEADS = "tblg4puX8qYpFYaH5";
const TABLE_COMMERCIAUX = "tblonJr5eh6Olozgz";

const CHAMPS = [
  "PRENOM", "NOM", "DATE", "RS", "VARIANTE_LP", "STATUT", "CANTON",
  "DATE_POSITIONNEMENT", "DATE_SIGNATURE", "HORODATAGE_ARRIVEE",
  "HORODATAGE_1ER_APPEL", "DELAI_1ER_APPEL_MIN", "ATTRIBUTION",
  "utm_campaign", "utm_content", "CALENDAR_EVENT_ID",
];

const STATUTS_MORTS = ["Refusé - Faux leads", "DOUBLON ne pas traiter"];
const STATUTS_ARGUMENTES = [
  "Signé", "Devis en cours", "Argumenté non signé",
  "Refusé", "Refusé - Devis Comparatif",
];

/* ---------------- Airtable ---------------- */

async function lireTable(table, params = {}) {
  const token = process.env.AIRTABLE_TOKEN;
  const sortie = [];
  let offset;

  do {
    const qs = new URLSearchParams({ pageSize: "100", ...params });
    if (offset) qs.set("offset", offset);
    const r = await fetch(`https://api.airtable.com/v0/${BASE}/${table}?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) throw new Error(`Airtable ${r.status} ${await r.text()}`);
    const data = await r.json();
    sortie.push(...data.records);
    offset = data.offset;
  } while (offset && sortie.length < 5000);

  return sortie;
}

async function lireLeads(du, au) {
  const params = new URLSearchParams();
  CHAMPS.forEach((c) => params.append("fields[]", c));
  params.set(
    "filterByFormula",
    `AND(IS_AFTER({DATE}, "${du}"), IS_BEFORE({DATE}, "${au}"))`
  );
  return lireTable(TABLE_LEADS, Object.fromEntries(params));
}

/* ---------------- Windsor.ai ---------------- */

async function lireDepenses(connecteur, du, au) {
  const cle = process.env.WINDSOR_API_KEY;
  if (!cle) return [];

  const qs = new URLSearchParams({
    api_key: cle,
    date_from: du,
    date_to: au,
    fields: "date,campaign,adset_name,ad_name,spend,clicks,impressions",
    _renderer: "json",
  });

  try {
    const r = await fetch(`https://connectors.windsor.ai/${connecteur}?${qs}`);
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data.data) ? data.data : [];
  } catch (e) {
    console.error("Windsor injoignable", connecteur, e);
    return [];
  }
}

/* ---------------- Classement en cohortes ---------------- */

function cohorteLead(f) {
  const rs = String(f.RS || "");
  if (rs.startsWith("GOOGLE")) return "google";
  if (rs === "META") return f.VARIANTE_LP ? "meta_lp" : "meta_form";
  return "autre";
}

function cohorteDepense(connecteur, campagne) {
  if (connecteur === "google_ads") return "google";
  return String(campagne || "").includes("[LP]") ? "meta_lp" : "meta_form";
}

/* ---------------- Calculs ---------------- */

const vide = () => ({
  leads: 0, contactes: 0, morts: 0, positionnes: 0, argumentes: 0, signes: 0,
  enLigne: 0, nonTraites: 0, depense: 0, clics: 0, impressions: 0,
  delais: [], sousUneHeure: 0, delaiPositionnement: [],
});

function mediane(liste) {
  if (!liste.length) return null;
  const t = [...liste].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : Math.round((t[m - 1] + t[m]) / 2);
}

function finaliser(c) {
  const tx = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
  const cout = (d, n) => (n > 0 && d > 0 ? Math.round((d / n) * 100) / 100 : null);
  return {
    ...c,
    depense: Math.round(c.depense * 100) / 100,
    tauxContact: tx(c.contactes, c.leads),
    tauxPositionnement: tx(c.positionnes, c.leads),
    tauxArgumente: tx(c.argumentes, c.positionnes),
    tauxSignature: tx(c.signes, c.positionnes),
    tauxSignatureGlobal: tx(c.signes, c.leads),
    tauxMorts: tx(c.morts, c.leads),
    coutParLead: cout(c.depense, c.leads),
    coutParPositionne: cout(c.depense, c.positionnes),
    coutParSigne: cout(c.depense, c.signes),
    delaiMedianMin: mediane(c.delais),
    partSousUneHeure: tx(c.sousUneHeure, c.contactes),
    delaiPositionnementMedianJours: mediane(c.delaiPositionnement),
    delais: undefined,
    delaiPositionnement: undefined,
  };
}

/* ---------------- Route ---------------- */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, erreur: "Méthode non autorisée" });
  }

  const { code, du, au } = req.body || {};
  const codes = (process.env.ACCESS_CODES || "").split(",").map((c) => c.trim());
  if (!code || !codes.includes(code)) {
    return res.status(401).json({ ok: false, erreur: "Code d'accès invalide" });
  }
  if (!du || !au) {
    return res.status(400).json({ ok: false, erreur: "Période manquante" });
  }

  try {
    const veille = new Date(new Date(du).getTime() - 86400000).toISOString().slice(0, 10);
    const lendemain = new Date(new Date(au).getTime() + 86400000).toISOString().slice(0, 10);

    const [leads, commerciaux, meta, google] = await Promise.all([
      lireLeads(veille, lendemain),
      lireTable(TABLE_COMMERCIAUX, { "fields[]": "PRENOM" }),
      lireDepenses("facebook", du, au),
      lireDepenses("google_ads", du, au),
    ]);

    const nomsConseillers = Object.fromEntries(
      commerciaux.map((c) => [c.id, c.fields.PRENOM || "?"])
    );

    const cohortes = {
      google: vide(), meta_form: vide(), meta_lp: vide(), autre: vide(),
    };
    const creatives = {};
    const parConseiller = {};
    const parJour = {};

    for (const l of leads) {
      const f = l.fields;
      const k = cohorteLead(f);
      const c = cohortes[k];
      const statut = String(f.STATUT || "");

      c.leads += 1;
      if (f.HORODATAGE_1ER_APPEL) {
        c.contactes += 1;
        const d = Number(f.DELAI_1ER_APPEL_MIN);
        if (Number.isFinite(d) && d >= 0) {
          c.delais.push(d);
          if (d <= 60) c.sousUneHeure += 1;
        }
      }
      if (statut === "Non-traité") c.nonTraites += 1;
      if (STATUTS_MORTS.includes(statut)) c.morts += 1;
      if (STATUTS_ARGUMENTES.includes(statut)) c.argumentes += 1;
      if (statut === "Signé" || f.DATE_SIGNATURE) c.signes += 1;

      if (f.DATE_POSITIONNEMENT) {
        c.positionnes += 1;
        if (String(f.CALENDAR_EVENT_ID || "").includes("calendly")) c.enLigne += 1;
        if (f.HORODATAGE_ARRIVEE) {
          const j = (new Date(f.DATE_POSITIONNEMENT) - new Date(f.HORODATAGE_ARRIVEE)) / 86400000;
          if (j >= 0 && j < 120) c.delaiPositionnement.push(Math.round(j * 10) / 10);
        }
        const rec = (f.ATTRIBUTION || [])[0];
        if (rec) {
          const nom = nomsConseillers[rec] || "Inconnu";
          parConseiller[nom] = parConseiller[nom] || { positionnes: 0, signes: 0 };
          parConseiller[nom].positionnes += 1;
          if (statut === "Signé") parConseiller[nom].signes += 1;
        }
      }

      const jour = String(f.DATE || "").slice(0, 10);
      if (jour) {
        parJour[jour] = parJour[jour] || { google: 0, meta_form: 0, meta_lp: 0, positionnes: 0 };
        if (parJour[jour][k] !== undefined) parJour[jour][k] += 1;
        if (f.DATE_POSITIONNEMENT) parJour[jour].positionnes += 1;
      }

      if (k === "meta_lp") {
        const pub = String(f.utm_content || "(sans UTM)").replace(/\+/g, " ");
        creatives[pub] = creatives[pub] || {
          publicite: pub,
          campagne: String(f.utm_campaign || "").replace(/\+/g, " "),
          leads: 0, positionnes: 0, signes: 0, depense: 0,
        };
        creatives[pub].leads += 1;
        if (f.DATE_POSITIONNEMENT) creatives[pub].positionnes += 1;
        if (statut === "Signé") creatives[pub].signes += 1;
      }
    }

    const ajouterDepense = (lignes, connecteur) => {
      for (const d of lignes) {
        const k = cohorteDepense(connecteur, d.campaign);
        const montant = Number(d.spend) || 0;
        cohortes[k].depense += montant;
        cohortes[k].clics += Number(d.clicks) || 0;
        cohortes[k].impressions += Number(d.impressions) || 0;

        if (k === "meta_lp") {
          const pub = String(d.ad_name || "(sans nom)").replace(/\+/g, " ");
          creatives[pub] = creatives[pub] || {
            publicite: pub, campagne: String(d.campaign || ""),
            leads: 0, positionnes: 0, signes: 0, depense: 0,
          };
          creatives[pub].depense += montant;
        }
      }
    };
    ajouterDepense(meta, "facebook");
    ajouterDepense(google, "google_ads");

    const listeCreatives = Object.values(creatives)
      .map((c) => ({
        ...c,
        depense: Math.round(c.depense * 100) / 100,
        coutParLead: c.leads ? Math.round((c.depense / c.leads) * 100) / 100 : null,
        coutParPositionne: c.positionnes
          ? Math.round((c.depense / c.positionnes) * 100) / 100
          : null,
        tauxPositionnement: c.leads
          ? Math.round((c.positionnes / c.leads) * 1000) / 10
          : null,
      }))
      .sort((a, b) => (b.positionnes - a.positionnes) || (b.leads - a.leads));

    return res.status(200).json({
      ok: true,
      periode: { du, au },
      depensesDisponibles: meta.length + google.length > 0,
      cohortes: Object.fromEntries(
        Object.entries(cohortes).map(([k, v]) => [k, finaliser(v)])
      ),
      creatives: listeCreatives,
      parConseiller,
      parJour: Object.entries(parJour)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([jour, v]) => ({ jour, ...v })),
    });
  } catch (e) {
    console.error("Erreur dashboard", e);
    return res.status(500).json({ ok: false, erreur: String(e.message || e) });
  }
}
