"use strict";
/* ============================================================================
   Weltsparen (Raisin) → ExtraETF converter.
   ---------------------------------------------------------------------------
   File (kind):
     transactions — Verrechnungskonto-Umsätze (transactions-JJJJ-MM-TT.csv,
       Weltsparen-Web unter "Transaktionen" exportierbar):
       semicolon-separated, ENGLISH decimals ("-20490.84"), ISO dates, header
       Buchungsdatum;Wertstellungsdatum;Kontoinhaber;Kontonummer / IBAN;BIC;
       Verwendungszweck;Betrag;Währung
       Every row is seen from the Weltsparen-Verrechnungskonto (+ = Zufluss).

   Mapping decisions:
     · Tages-/Festgeld sind keine Wertpapiere → nichts ist CSV-importierbar
       (rows bleibt leer, Download deaktiviert). Alle Buchungen werden
       kategorisiert und unter "Cash / Kontobuchungen" + "Hinweise" fürs
       manuelle Erfassen aufbereitet.
     · Kategorien per Verwendungszweck: Steuern (AGS/KIST/SOLI-Abzüge der
       Raisin Bank), Zinsen (…Zins…), Anlagen (PYI / Top Up / Opening, negativ),
       Anlage-Rückzahlungen (Anlagebetrag / Withdrawal / Auszahlung FDA|OMA, positiv).
       FDA_… = Festgeld, OMA_… = Tagesgeld.
     · Referenzkonto-Erkennung: IBANs aus so klassifizierten Zeilen sind Produkt-/
       Raisin-Konten. Übrige Zeilen: bekannte Produkt-IBAN = interne Umbuchung
       ohne Verwendungszweck (Tagesgeld-Sparrate etc.); unbekannte IBAN =
       Referenzkonto → Einzahlung/Auszahlung.
     · Tagesgeld-Zinsen schreibt Weltsparen dem Tagesgeldkonto direkt gut; sie
       kommen nur in Rückzahlungen ohne Verwendungszweck zurück → Banner-Hinweis,
       die betroffenen Beträge sind in der Umbuchungs-Tabelle markiert.
     · Empfohlene Buchung: Weltsparen als EIN ExtraETF-Verrechnungskonto führen —
       Einzahlungen/Auszahlungen/Zinsen/Steuern buchen, interne Umbuchungen
       zwischen Verrechnungskonto und Tages-/Festgeld nicht.
     · Der "Buchungsplan" listet dafür fertige Cash-Buchungen, alles JE JAHR
       aggregiert (ExtraETF hat keinen Cash-Import, jede Buchung ist Handarbeit):
       Einzahlungen (Gutschrift), Auszahlungen (Abbuchung), Zinsen und Steuern
       (Zinsen/Gebühren), jeweils datiert auf die letzte Buchung des Jahres.
       Gebühren kennt der Export nicht (Weltsparen zieht nur Steuern ab).
     · Überlappende Exporte werden dedupliziert (Zeilen-Identität je Datei:
       gleiche Zeile in mehreren Dateien = Duplikat, innerhalb einer Datei legitim).
   ============================================================================ */

(function () {

const X = globalThis.ExtraETF;
const { parseCSV, num, fmt, deDate } = X;

const L = {
  einzahlung: "Einzahlungen (Referenzkonto → Weltsparen)",
  auszahlung: "Auszahlungen (Weltsparen → Referenzkonto)",
  zinsen:     "Zinsen Tages-/Festgeld (als „Zinsen“ buchen)",
  steuern:    "Steuern: Abgeltungsteuer + Soli + Kirchensteuer (als „Steuern“ buchen)"
};
const CASH_ORDER = [L.einzahlung, L.auszahlung, L.zinsen, L.steuern];

const productOf = p => /FDA[-_]\d/.test(p) ? "Festgeld" : /OMA[-_]\d/.test(p) ? "Tagesgeld" : "";
const grab = (re, s) => { const m = s.match(re); return m ? parseFloat(m[1]) : 0; };

function convert(files){
  /* ---- parse all files; dedupe overlapping exports per row identity ---- */
  const byKey = new Map();          // rowKey → per-file record lists (max wins)
  files.forEach((f, fi) => {
    let idx = null;
    for(const r of parseCSV(f.text, ";")){
      const c = r.map(x => (x == null ? "" : "" + x).trim());
      if(c[0] === "Buchungsdatum"){ idx = {}; c.forEach((h,i)=>idx[h]=i); continue; }
      if(!idx) continue;
      const g = k => (idx[k] == null ? "" : c[idx[k]] || "");
      const amt = num(g("Betrag"));
      if(!g("Buchungsdatum") || isNaN(amt)) continue;
      const t = {
        date: deDate(g("Buchungsdatum")),
        holder: g("Kontoinhaber"), iban: g("Kontonummer / IBAN"), bic: g("BIC"),
        purpose: g("Verwendungszweck").replace(/\s+/g, " ").trim(),
        amt, ccy: g("Währung") || "EUR"
      };
      const key = [t.date, t.iban, t.purpose, t.amt, t.ccy].join("|");
      const perFile = byKey.get(key) || byKey.set(key, new Map()).get(key);
      const list = perFile.get(fi) || perFile.set(fi, []).get(fi);
      list.push(t);
    }
  });
  const txns = []; let dups = 0;
  for(const perFile of byKey.values()){
    const lists = [...perFile.values()].sort((a,b) => b.length - a.length);
    txns.push(...lists[0]);                                  // keep in-file repeats,
    dups += lists.slice(1).reduce((s,l) => s + l.length, 0); // drop cross-file overlap
  }

  /* ---- pass 1: classify by Verwendungszweck, learn product/Raisin IBANs ---- */
  const cats = { einzahlung:[], auszahlung:[], zinsen:[], steuern:[], anlage:[], rueckzahlung:[] };
  const productIbans = new Set(), leftovers = [];
  for(const t of txns){
    const p = t.purpose;
    if(t.amt < 0 && /AGS[\d.]+EUR/i.test(p)){                // Raisin-Steuerabzug
      t.ags = grab(/AGS([\d.]+)EUR/i, p); t.kist = grab(/KIST([\d.]+)EUR/i, p); t.soli = grab(/SOLI([\d.]+)EUR/i, p);
      cats.steuern.push(t); productIbans.add(t.iban);
    } else if(t.amt > 0 && /zins/i.test(p)){                 // Zinsauszahlung / Auszahlung - Zinsen
      cats.zinsen.push(t); productIbans.add(t.iban);
    } else if(t.amt < 0 && /\bPYI\b|Top Up|Opening/i.test(p)){  // Anlage in Festgeld/Tagesgeld
      cats.anlage.push(t); productIbans.add(t.iban);
    } else if(t.amt > 0 && /Anlagebetrag|Withdrawal|Auszahlung.*(FDA|OMA)[-_]/i.test(p)){
      cats.rueckzahlung.push(t); productIbans.add(t.iban);   // Anlagebetrag zurück
    } else leftovers.push(t);
  }

  /* ---- pass 2: leftovers — known product IBAN = intern, sonst Referenzkonto ---- */
  for(const t of leftovers){
    if(productIbans.has(t.iban)){
      t.unlabeled = t.amt > 0;                               // kann Zinsen enthalten
      cats[t.amt < 0 ? "anlage" : "rueckzahlung"].push(t);
    } else cats[t.amt > 0 ? "einzahlung" : "auszahlung"].push(t);
  }

  /* ---- cash summary (nur die manuell zu buchenden Kategorien) ---- */
  const cashSummary = {};
  const add = (label, t) => {
    const s = cashSummary[label] || (cashSummary[label] = { ccy: {} });
    s.ccy[t.ccy] = (s.ccy[t.ccy] || 0) + t.amt;
  };
  cats.einzahlung.forEach(t => add(L.einzahlung, t));
  cats.auszahlung.forEach(t => add(L.auszahlung, t));
  cats.zinsen.forEach(t => add(L.zinsen, t));
  cats.steuern.forEach(t => add(L.steuern, t));

  /* ---- banners + stats + note tables ---- */
  const sum = a => a.reduce((s,t) => s + t.amt, 0);
  const eur = v => fmt(Math.round(v * 100) / 100) + " €";
  const unlabeled = cats.rueckzahlung.filter(t => t.unlabeled);

  const banners = [{ kind: "warn", parts: [
    { b: "Tages-/Festgeld ist kein Wertpapier" },
    " – ExtraETF kann davon nichts per CSV importieren. Alle Buchungen sind unten kategorisiert: Weltsparen als ",
    { b: "ein Verrechnungskonto" },
    " in ExtraETF führen und die Cash-Buchungen aus dem ", { b: "Buchungsplan" },
    " (unter „Hinweise“) erfassen: Einzahlungen, Auszahlungen, Zinsen und Steuern, je Jahr aggregiert. Interne Umbuchungen zwischen Verrechnungskonto und Tages-/Festgeld ",
    { b: "nicht buchen" }, " – das Geld bleibt bei Weltsparen."] }];
  if(unlabeled.length) banners.push({ kind: "warn", parts: [
    { b: `${unlabeled.length} Rückzahlung(en) ohne Verwendungszweck` },
    " (in der Umbuchungs-Tabelle markiert): Tagesgeld-Zinsen schreibt Weltsparen direkt dem Tagesgeldkonto gut, sie tauchen im Export nicht separat auf – diese Beträge können daher Zinsen enthalten. Zinshöhe ggf. im Weltsparen-Postfach prüfen und manuell als Zinsen buchen."] });
  if(dups) banners.push({ kind: "good", parts: [
    { b: `${dups} doppelte Buchung(en)` },
    " aus überlappenden Exporten erkannt und übersprungen."] });

  const stats = [
    ["Cash-Buchungen", cats.einzahlung.length + cats.auszahlung.length + cats.zinsen.length + cats.steuern.length],
    ["Zinsen erhalten", eur(sum(cats.zinsen))],
    ["Steuern abgeführt", eur(-sum(cats.steuern))],
    ["Saldo Verrechnungskonto", eur(sum(txns))],
    // = Ein − Aus + Zinsen − Steuern: muss dem echten Weltsparen-Gesamtstand
    // entsprechen (zzgl. nicht ausgewiesener Tagesgeld-Zinsen) → Abgleichszahl.
    ["Noch angelegt (lt. Export)", eur(sum(cats.einzahlung) + sum(cats.auszahlung) + sum(cats.zinsen) + sum(cats.steuern))]
  ];

  const cell = (t, n) => n ? { t: t == null ? "" : "" + t, num: true } : (t == null ? "" : "" + t);
  const partner = t => t.holder || t.bic || "–";
  const note = (title, items, cols, rowFn) =>
    items.length ? { title, cols, rows: items.map(rowFn) } : null;

  /* ---- Buchungsplan: alle Kategorien je Jahr aggregiert ---- */
  const dKey = d => d.split(".").reverse().join("");           // TT.MM.JJJJ → JJJJMMTT
  const byYear = (items) => {
    const g = {};
    for(const t of items){
      const y = t.date.slice(6);
      const o = g[y] || (g[y] = { y, d: t.date, amt: 0, n: 0, ccy: t.ccy, ags: 0, soli: 0, kist: 0 });
      o.amt += t.amt; o.n++; o.ags += t.ags || 0; o.soli += t.soli || 0; o.kist += t.kist || 0;
      if(dKey(t.date) > dKey(o.d)) o.d = t.date;               // letzte Buchung des Jahres
    }
    return Object.values(g);
  };
  const plan = [];
  for(const o of byYear(cats.einzahlung)) plan.push({ d: o.d, typ: "Gutschrift", amt: o.amt, ccy: o.ccy,
    txt: `Weltsparen Einzahlungen ${o.y} (${o.n} Buchungen)` });
  for(const o of byYear(cats.auszahlung)) plan.push({ d: o.d, typ: "Abbuchung", amt: o.amt, ccy: o.ccy,
    txt: `Weltsparen Auszahlungen ${o.y} (${o.n} Buchungen)` });
  for(const o of byYear(cats.zinsen)) plan.push({ d: o.d, typ: "Zinsen/Gebühren", amt: o.amt, ccy: o.ccy,
    txt: `Weltsparen Zinsen ${o.y}` });
  for(const o of byYear(cats.steuern)) plan.push({ d: o.d, typ: "Zinsen/Gebühren", amt: o.amt, ccy: o.ccy,
    txt: `Weltsparen Steuern ${o.y} (Abgeltungsteuer ${fmt(o.ags)}, Soli ${fmt(o.soli)}, KiSt ${fmt(o.kist)})` });
  plan.sort((a,b) => dKey(a.d) < dKey(b.d) ? -1 : dKey(a.d) > dKey(b.d) ? 1 : 0);

  const notes = [
    note(`Buchungsplan – ${plan.length} Cash-Buchungen (je Jahr aggregiert, datiert auf die letzte Buchung des Jahres)`, plan,
      ["Datum", "ExtraETF-Typ", { t: "Betrag", num: true }, "Kommentar"],
      p => [cell(p.d), cell(p.typ), cell(`${fmt(Math.round(p.amt*100)/100)} ${p.ccy}`, true), cell(p.txt)]),
    note(`Zinsen – als Cash-Buchung „Zinsen“ erfassen (Summe ${eur(sum(cats.zinsen))})`, cats.zinsen,
      ["Datum", "Partnerbank", "Produkt", { t: "Betrag", num: true }],
      t => [cell(t.date), cell(partner(t)), cell(productOf(t.purpose) || "–"), cell(`${fmt(t.amt)} ${t.ccy}`, true)]),
    note(`Steuern – als Cash-Buchung „Steuern“ erfassen (Summe ${eur(sum(cats.steuern))})`, cats.steuern,
      ["Datum", { t: "Abgeltungsteuer", num: true }, { t: "Soli", num: true }, { t: "Kirchensteuer", num: true }, { t: "Gesamt", num: true }],
      t => [cell(t.date), cell(fmt(-t.ags), true), cell(fmt(-t.soli), true), cell(fmt(-t.kist), true), cell(`${fmt(t.amt)} ${t.ccy}`, true)]),
    note(`Einzahlungen (Referenzkonto → Weltsparen, Summe ${eur(sum(cats.einzahlung))})`, cats.einzahlung,
      ["Datum", "Verwendungszweck", { t: "Betrag", num: true }],
      t => [cell(t.date), cell(t.purpose || "–"), cell(`${fmt(t.amt)} ${t.ccy}`, true)]),
    note(`Auszahlungen (Weltsparen → Referenzkonto, Summe ${eur(sum(cats.auszahlung))})`, cats.auszahlung,
      ["Datum", "Verwendungszweck", { t: "Betrag", num: true }],
      t => [cell(t.date), cell(t.purpose || "–"), cell(`${fmt(t.amt)} ${t.ccy}`, true)]),
    note("Interne Umbuchungen Verrechnungskonto ↔ Tages-/Festgeld – nicht buchen", [...cats.anlage, ...cats.rueckzahlung],
      ["Datum", "Partnerbank", "Buchung", "Produkt", { t: "Betrag", num: true }],
      t => [cell(t.date), cell(partner(t)),
            cell(t.amt < 0 ? "Anlage" : (t.unlabeled ? "Rückzahlung (evtl. inkl. Zinsen)" : "Rückzahlung Anlagebetrag")),
            cell(productOf(t.purpose) || "Tages-/Festgeld"), cell(`${fmt(t.amt)} ${t.ccy}`, true)])
  ];

  return {
    rows: [], positions: {}, cashSummary, cashOrder: CASH_ORDER,
    banners, notes: notes.filter(Boolean), stats
  };
}

/* ============================ registration ============================ */
X.register({
  id: "weltsparen",
  label: "Weltsparen",
  kindLabels: { transactions: "Weltsparen" },
  detect(text, name){
    if(/Buchungsdatum;Wertstellungsdatum;Kontoinhaber;Kontonummer \/ IBAN/.test(text)) return "transactions";
    if(/^transactions-\d{4}-\d{2}-\d{2}/i.test(name || "") && /Buchungsdatum/.test(text)) return "transactions";
    return null;
  },
  convert
});

})();
