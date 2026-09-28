import React, { useState, useEffect } from "react";

const C = {
  jaune: "#E3DC00",
  anthracite: "#2F2F2E",
  fond: "#F4F4F3",
  blanc: "#FFFFFF",
  gris: "#6B6B6A",
  ligne: "#E4E4E3",
  vert: "#1F7A5C",
  rouge: "#C8102E",
};

const COHORTES = [
  { cle: "google", nom: "Google Ads", couleur: "#4285F4" },
  { cle: "meta_form", nom: "Meta formulaire", couleur: "#0866FF" },
  { cle: "meta_lp", nom: "Meta landing page", couleur: "#1F7A5C" },
];

const chf = (v) => (v == null ? "—" : `${v.toLocaleString("fr-CH")} CHF`);
const pct = (v) => (v == null ? "—" : `${String(v).replace(".", ",")} %`);
const nb = (v) => (v == null ? "—" : v.toLocaleString("fr-CH"));

function debutDeMois() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function App() {
  const [code, setCode] = useState(localStorage.getItem("code_perf") || "");
  const [connecte, setConnecte] = useState(false);
  const [du, setDu] = useState(debutDeMois());
  const [au, setAu] = useState(new Date().toISOString().slice(0, 10));
  const [onglet, setOnglet] = useState("apercu");
  const [data, setData] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  const charger = async (codeUtilise) => {
    setChargement(true);
    setErreur("");
    try {
      const r = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeUtilise || code, du, au }),
      });
      const res = await r.json();
      if (!res.ok) throw new Error(res.erreur || "Erreur");
      setData(res);
      setConnecte(true);
      localStorage.setItem("code_perf", codeUtilise || code);
    } catch (e) {
      setErreur(String(e.message || e));
      if (String(e.message).includes("Code")) setConnecte(false);
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    if (code) charger(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (connecte) charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [du, au]);

  if (!connecte) {
    return (
      <div style={{ minHeight: "100vh", background: C.fond, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ background: C.blanc, padding: 40, borderRadius: 12, width: 360, boxShadow: "0 2px 18px rgba(0,0,0,.08)" }}>
          <h1 style={{ fontSize: 22, marginTop: 0, color: C.anthracite }}>Performance acquisition</h1>
          <p style={{ color: C.gris, fontSize: 14 }}>Entrez votre code d'accès.</p>
          <input value={code} onChange={(e) => setCode(e.target.value)} type="password"
            onKeyDown={(e) => e.key === "Enter" && charger()}
            style={{ width: "100%", padding: 12, fontSize: 16, border: `1px solid ${C.ligne}`, borderRadius: 6, boxSizing: "border-box" }} />
          <button onClick={() => charger()} disabled={chargement}
            style={{ width: "100%", marginTop: 14, padding: 12, fontSize: 15, fontWeight: 700, background: C.jaune, border: "none", borderRadius: 6, cursor: "pointer" }}>
            {chargement ? "Vérification…" : "Entrer"}
          </button>
          {erreur && <p style={{ color: C.rouge, fontSize: 13 }}>{erreur}</p>}
        </div>
      </div>
    );
  }

  const co = data?.cohortes || {};

  return (
    <div style={{ minHeight: "100vh", background: C.fond, fontFamily: "system-ui, sans-serif", color: C.anthracite }}>
      <header style={{ background: C.anthracite, color: C.blanc, padding: "18px 28px", display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <strong style={{ fontSize: 18 }}>Performance acquisition</strong>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: "auto" }}>
          <input type="date" value={du} onChange={(e) => setDu(e.target.value)} style={{ padding: 6, borderRadius: 5, border: "none" }} />
          <span style={{ opacity: .7 }}>au</span>
          <input type="date" value={au} onChange={(e) => setAu(e.target.value)} style={{ padding: 6, borderRadius: 5, border: "none" }} />
          <button onClick={() => charger()} style={{ padding: "7px 14px", borderRadius: 5, border: "none", background: C.jaune, fontWeight: 700, cursor: "pointer" }}>
            {chargement ? "…" : "Actualiser"}
          </button>
        </div>
      </header>

      <nav style={{ display: "flex", gap: 4, padding: "0 28px", background: C.blanc, borderBottom: `1px solid ${C.ligne}` }}>
        {[["apercu", "Vue d'ensemble"], ["funnel", "Funnel"], ["creatives", "Créatives"], ["ops", "Opérations"]].map(([k, l]) => (
          <button key={k} onClick={() => setOnglet(k)}
            style={{ padding: "14px 18px", border: "none", background: "none", cursor: "pointer", fontSize: 14, fontWeight: onglet === k ? 700 : 500, borderBottom: onglet === k ? `3px solid ${C.jaune}` : "3px solid transparent", color: C.anthracite }}>
            {l}
          </button>
        ))}
      </nav>

      <main style={{ padding: 28 }}>
        {erreur && <p style={{ color: C.rouge }}>{erreur}</p>}
        {!data && <p style={{ color: C.gris }}>Chargement…</p>}

        {data && !data.depensesDisponibles && (
          <div style={{ background: "#FFFDE8", border: `1px solid ${C.jaune}`, padding: 14, borderRadius: 8, marginBottom: 20, fontSize: 14 }}>
            Aucune dépense remontée par Windsor sur cette période : les coûts restent vides.
          </div>
        )}

        {data && onglet === "apercu" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
            {COHORTES.map((c) => {
              const d = co[c.cle] || {};
              return (
                <div key={c.cle} style={{ background: C.blanc, borderRadius: 12, padding: 24, border: `1px solid ${C.ligne}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 6, background: c.couleur }} />
                    <h2 style={{ fontSize: 17, margin: 0 }}>{c.nom}</h2>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <Bloc label="Dépense" valeur={chf(d.depense)} />
                    <Bloc label="Leads" valeur={nb(d.leads)} />
                    <Bloc label="Positionnés" valeur={nb(d.positionnes)} accent />
                    <Bloc label="Signés" valeur={nb(d.signes)} />
                    <Bloc label="Coût / lead" valeur={chf(d.coutParLead)} />
                    <Bloc label="Coût / RDV" valeur={chf(d.coutParPositionne)} accent />
                    <Bloc label="Taux de positionnement" valeur={pct(d.tauxPositionnement)} />
                    <Bloc label="Taux de signature" valeur={pct(d.tauxSignature)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {data && onglet === "funnel" && (
          <Tableau
            entetes={["Étape", ...COHORTES.map((c) => c.nom)]}
            lignes={[
              ["Leads reçus", ...COHORTES.map((c) => nb(co[c.cle]?.leads))],
              ["Contactés", ...COHORTES.map((c) => `${nb(co[c.cle]?.contactes)} (${pct(co[c.cle]?.tauxContact)})`)],
              ["Leads morts", ...COHORTES.map((c) => `${nb(co[c.cle]?.morts)} (${pct(co[c.cle]?.tauxMorts)})`)],
              ["Positionnés", ...COHORTES.map((c) => `${nb(co[c.cle]?.positionnes)} (${pct(co[c.cle]?.tauxPositionnement)})`)],
              ["dont réservés en ligne", ...COHORTES.map((c) => nb(co[c.cle]?.enLigne))],
              ["Argumentés", ...COHORTES.map((c) => `${nb(co[c.cle]?.argumentes)} (${pct(co[c.cle]?.tauxArgumente)})`)],
              ["Signés", ...COHORTES.map((c) => `${nb(co[c.cle]?.signes)} (${pct(co[c.cle]?.tauxSignature)})`)],
              ["Coût par signature", ...COHORTES.map((c) => chf(co[c.cle]?.coutParSigne))],
              ["Délai médian lead → RDV", ...COHORTES.map((c) => co[c.cle]?.delaiPositionnementMedianJours != null ? `${co[c.cle].delaiPositionnementMedianJours} j` : "—")],
            ]}
          />
        )}

        {data && onglet === "creatives" && (
          <>
            <p style={{ color: C.gris, fontSize: 14, marginTop: 0 }}>
              Uniquement les leads de la landing page, classés par nombre de rendez-vous positionnés.
            </p>
            <Tableau
              entetes={["Publicité", "Dépense", "Leads", "Positionnés", "Signés", "Coût / lead", "Coût / RDV", "Taux pos."]}
              lignes={(data.creatives || []).map((c) => [
                c.publicite, chf(c.depense), nb(c.leads), nb(c.positionnes),
                nb(c.signes), chf(c.coutParLead), chf(c.coutParPositionne), pct(c.tauxPositionnement),
              ])}
            />
          </>
        )}

        {data && onglet === "ops" && (
          <div style={{ display: "grid", gap: 24 }}>
            <Tableau
              entetes={["Indicateur", ...COHORTES.map((c) => c.nom)]}
              lignes={[
                ["Délai médian du 1er appel", ...COHORTES.map((c) => co[c.cle]?.delaiMedianMin != null ? `${co[c.cle].delaiMedianMin} min` : "—")],
                ["Rappelés en moins d'une heure", ...COHORTES.map((c) => pct(co[c.cle]?.partSousUneHeure))],
                ["Encore non traités", ...COHORTES.map((c) => nb(co[c.cle]?.nonTraites))],
                ["Clics", ...COHORTES.map((c) => nb(co[c.cle]?.clics))],
                ["Impressions", ...COHORTES.map((c) => nb(co[c.cle]?.impressions))],
              ]}
            />
            <Tableau
              entetes={["Conseiller", "RDV positionnés", "Signés"]}
              lignes={Object.entries(data.parConseiller || {})
                .sort((a, b) => b[1].positionnes - a[1].positionnes)
                .map(([nom, v]) => [nom, nb(v.positionnes), nb(v.signes)])}
            />
          </div>
        )}
      </main>
    </div>
  );
}

function Bloc({ label, valeur, accent }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: C.gris, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent ? C.vert : C.anthracite }}>{valeur}</div>
    </div>
  );
}

function Tableau({ entetes, lignes }) {
  return (
    <div style={{ background: C.blanc, borderRadius: 12, border: `1px solid ${C.ligne}`, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr>
            {entetes.map((e) => (
              <th key={e} style={{ textAlign: "left", padding: "14px 18px", borderBottom: `2px solid ${C.anthracite}`, whiteSpace: "nowrap" }}>{e}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={i}>
              {l.map((v, j) => (
                <td key={j} style={{ padding: "12px 18px", borderBottom: `1px solid ${C.ligne}`, fontWeight: j === 0 ? 600 : 400, whiteSpace: "nowrap" }}>{v}</td>
              ))}
            </tr>
          ))}
          {!lignes.length && (
            <tr><td style={{ padding: 18, color: C.gris }}>Aucune donnée sur cette période.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
