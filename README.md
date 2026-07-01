# CapTrader → ExtraETF Konverter

Tool zur Konvertierung von CapTrader-Transaktionen (Cash, Trades) in ExtraETF-Import-CSV-Dateien.

> 🔒 **Datenschutz:** Läuft vollständig lokal im Browser – keine Abhängigkeiten, kein Server, keine
> Netzwerkaufrufe, keine Uploads.
>
> ⚠️ **Kein offizielles Tool:** Konverter und Claude-Code-Skill (`.claude/skills/extraetf-import-ops/`)
> stehen in **keiner Verbindung** zu ExtraETF, CapTrader oder Interactive Brokers. Nutzung **ohne Gewähr
> und auf eigenes Risiko** – erzeugte Importe und Buchungen bitte selbst kontrollieren.

## Was es kann

- **Trades** → `Kauf` / `Verkauf` (inkl. Gebühren, Fremdwährung, Wechselkurs)
- **Anleihen** → Kurs in **% des Nominals**, Nominalwert als Anzahl
- **Dividenden** → **brutto** mit zugeordneter **Quellensteuer** (netto = Preis − Steuern)
- **Stornobuchungen** (`BUY (Ca.)`) → über die vorzeichenbehaftete Stückzahl korrekt gegengebucht
- **Fremdwährungen** (USD/HKD/GBP/NOK/SEK/…) → `Wechselkurs` = Einheiten je EUR (= 1 / IB `FXRateToBase`)
- **Optionaler Bestandsabgleich:** mit hochgeladenem CapTrader-*Bestand* ergänzt der Konverter automatisch
  `Einbuchung` / `Ausbuchung`, damit die Positionen exakt dem Auszug entsprechen (z. B. bei Corporate Actions).

## Schnellstart

1. `captrader-to-extraetf.html` im Browser öffnen (Doppelklick genügt – kein Server nötig).
2. Die CapTrader-CSVs hineinziehen (Trades + Cash, gern alle Jahre gleichzeitig; optional den *Bestand*).
3. Vorschau und Hinweise prüfen.
4. **„ExtraETF-Import-CSV herunterladen"** → `extraetf-import.csv`.
5. In ExtraETF unter **Datenimport → CSV importieren** einlesen (siehe unten).

## Flex Queries in CapTrader einrichten

Im CapTrader-/IB-Kundenportal unter **Berichte / Reporting → Flex Queries** zwei *Activity Flex Queries*
anlegen – eine für **Trades**, eine für **Cash**. Zeitraum frei wählbar (gesamte Kontolaufzeit oder pro
Jahr; das Tool verarbeitet beliebig viele Dateien auf einmal).

Für **beide** Queries identisch:

- Format **CSV**, Spaltenüberschriften **Ja**
- Datum **dd/MM/yyyy**, Zeit `HH:mm:ss`, Trennzeichen Leerzeichen
- Überschrift/Trailer, Titelzeile, Abschnittscode, Prüfpfad, Tages-Aufschlüsselung, Offsetting-/Cancel-Paare: **Nein**

Unterschiede:

- **Trades-Query:** Abschnitt `Trades`, Wechselkurse **Nein**
- **Cash-Query:** Abschnitt `Bartransaktionen`, Wechselkurse **Ja**

## Import in ExtraETF

1. Oben rechts **Datenimport → „CSV importieren"**, Ziel-**Depot** wählen.
2. `extraetf-import.csv` hochladen, Vorschau prüfen, **Speichern**.
   *(Der CSV-Import ist eine Premium-Funktion ab dem Tarif „Investor".)*

Format der erzeugten Datei (Semikolon-getrennt, deutsches Zahlenformat, `TT.MM.JJJJ`):

```
Datum;ISIN;Name;Typ;Transaktion;Preis;Anzahl;Gebühren;Steuern;Währung;Wechselkurs
```

## Manuell nachzupflegen (nicht per CSV importierbar)

ExtraETF importiert per CSV nur **Wertpapier-Transaktionen**. Reine Cash-Bewegungen listet der Konverter
unter **„Cash / Kontobuchungen"**; sie werden über **„Neue Aktivität → Cash"** erfasst (und je Konto
„Berücksichtigen" aktivieren, damit Cash zum Gesamtvermögen zählt):

- **Ein-/Auszahlungen, Broker-Zinsen, Gebühren, Quellensteuer auf Zinsen, Anleihe-Stückzinsen** → als Cash-Buchung.
- **Anleihe-Kupons:** ExtraETF hat **keinen `Kupon`-Typ** → am besten als **`Dividende` auf die jeweilige
  Anleihe** buchen (Betrag in „Dividendensumme (vor Steuern)"; die Position bleibt unverändert).
- **Verrechnungskonto:** Für ein exaktes Gesamtvermögen den Kontostand auf den CapTrader-Endbarsaldo
  abgleichen – dokumentierte Zahlungsströme als Cash-Buchungen, die verbleibende FX-/Rundungsdifferenz als
  eine Ausgleichsbuchung.

## Bekannte ExtraETF-Besonderheiten

Der Konverter erzeugt eine korrekte CSV; die folgenden Punkte liegen **an ExtraETF**:

- **Typ** wird von ExtraETF anhand der ISIN selbst erkannt – die Typ-Spalte der CSV ist nur ein Hinweis.
- **Fremdwährungs-Dividenden:** ExtraETF **ignoriert beim CSV-Import den `Wechselkurs` bei `Dividende`**
  und bucht `Preis` / `Steuern` als **EUR** (z. B. `318 HKD` → `318 €`, ~9× zu hoch; USD ≈ EUR fällt kaum
  auf). `Kauf` / `Verkauf` werden korrekt umgerechnet. Workaround: solche Dividenden in EUR umgerechnet
  buchen (Betrag in EUR, `Währung=EUR`) – oder bei ExtraETF melden.
- **Split mit ISIN-Wechsel** (z. B. 5:1 mit neuer ISIN): ExtraETF fügt einen **nicht löschbaren „Split"**
  ein und bewertet die neue Stückzahl mit dem **Vor-Split-Kurs** (Position überhöht). Manuelle
  `Kauf` / `Einbuchung` auf ein solches Papier **werden stillschweigend nicht gespeichert** – die Position
  lässt sich nur per **CSV-Import** (`Einbuchung`) anlegen.

## Projektstruktur

- `captrader-to-extraetf.html` — Oberfläche (öffnen & benutzen).
- `styles.css` — Styles. &nbsp; `converter.js` — Parsing-/Konvertierungslogik (gekapseltes Modul).
- `.claude/skills/extraetf-import-ops/` — Claude-Code-Skill für schnelle manuelle ExtraETF-Arbeiten
  (Buchen/Löschen, CSV-Import, Reconciliation, bekannte Import-Fehler).
- Eigene CapTrader-Exporte, `extraetf-import.csv` u. Ä. bleiben lokal und werden **nicht** versioniert
  (siehe `.gitignore`).

## Lizenz

Siehe [`LICENSE`](LICENSE).
