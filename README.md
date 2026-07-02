# CapTrader → ExtraETF Konverter

Tool zur Konvertierung von CapTrader-Transaktionen (Cash, Trades) in ExtraETF-Import-CSVs.

🔒 **Datenschutz:** Läuft vollständig lokal im Browser – kein Server, keine Netzwerkaufrufe, keine Uploads.

⚠️ **Kein offizielles Tool:** Konverter und [Claude-Code-Skill](.claude/skills/extraetf-import-ops/) stehen in keiner Verbindung zu ExtraETF, CapTrader oder Interactive Brokers. Nutzung **ohne Gewähr, auf eigenes Risiko** – erzeugte Importe bitte selbst prüfen.

## Warum dieses Tool?

ExtraETF bietet zwar einen Interactive-Brokers-Import über WealthAPI an, über den sich auch CapTrader anbinden lässt. Diese Anbindung ist jedoch fehleranfällig, und die übernommenen Daten sind unvollständig – so werden z. B. ISINs abgeschnitten.

Verlässlicher ist der manuelle Export als Interactive-Brokers-*Flex-Query*-CSV, dessen Format allerdings nicht zum ExtraETF-Import passt. Dieses Tool schließt die Lücke und rechnet die Exporte automatisch um (inklusive Anleihen, Fremdwährung, Quellensteuer, Stornos, Corporate Actions), sodass der importierte Depotwert dem CapTrader-Auszug entspricht.

## Was es kann

- **Trades** → `Kauf` / `Verkauf` (inkl. Gebühren, Fremdwährung, Wechselkurs)
- **Anleihen** → Kurs in % des Nominals, Nominalwert als Anzahl
- **Dividenden** → brutto mit zugeordneter Quellensteuer (netto = Preis − Steuern)
- **Stornobuchungen** (`BUY (Ca.)`) → über die vorzeichenbehaftete Stückzahl korrekt gegengebucht
- **Fremdwährungen** → Wechselkurs = Einheiten je EUR (= 1 / `FXRateToBase`)
- **Optionaler Bestandsabgleich:** mit CapTrader-*Bestand* ergänzt der Konverter `Einbuchung` / `Ausbuchung`, sodass die Positionen exakt dem Auszug entsprechen (z. B. bei Corporate Actions).

## Voraussetzungen

### Flex Queries in CapTrader einrichten

Im CapTrader-/IB-Kundenportal unter Berichte → Flex Queries zwei *Activity Flex Queries* anlegen – eine für Trades, eine für Cash. Zeitraum frei wählbar (gesamte Laufzeit oder pro Jahr; das Tool verarbeitet beliebig viele Dateien).

Für beide Flex Queries identisch:

- Format: CSV, Spaltenüberschriften: Ja
- Datum `dd/MM/yyyy`, Zeit `HH:mm:ss`
- Trennzeichen Leerzeichen, Überschrift/Trailer, Titelzeile, Abschnittscode, Prüfpfad, Tages-Aufschlüsselung, Offsetting-/Cancel-Paare: Nein

Unterschiede:

- **Trades:** Abschnitt `Trades`, Wechselkurse Nein
- **Cash:** Abschnitt `Bartransaktionen`, Wechselkurse Ja

### Bestand exportieren (optional)

Der *Bestand* für den optionalen Bestandsabgleich wird im Kundenportal aus der Umsatzübersicht (Berichte → Kontoauszüge → Kontoauszug) als CSV exportiert.

## Schnellstart

1. `captrader-to-extraetf.html` im Browser öffnen (Doppelklick genügt – kein Server nötig).
2. CapTrader-CSVs hineinziehen (Trades + Cash, optional den *Bestand*).
3. Vorschau und Hinweise prüfen.
4. „ExtraETF-Import-CSV herunterladen" → `extraetf-import.csv`.
5. In ExtraETF unter Datenimport → CSV importieren einlesen.

## Manuell nachzupflegen

ExtraETF importiert nur Wertpapier-Transaktionen. Reine Cash-Bewegungen listet der Konverter unter „Cash / Kontobuchungen"; erfasse sie über „Neue Aktivität → Cash" (und je Konto „Berücksichtigen" aktivieren, damit Cash zum Gesamtvermögen zählt):

- Ein-/Auszahlungen, Broker-Zinsen, Gebühren, Quellensteuer auf Zinsen, Anleihe-Stückzinsen → als Cash-Buchung.
- **Anleihe-Kupons:** ExtraETF hat keinen `Kupon`-Typ → als `Dividende` auf die Anleihe buchen (Betrag in „Dividendensumme (vor Steuern)"; Position bleibt unverändert).
- **Verrechnungskonto:** Kontostand auf den CapTrader-Endbarsaldo abgleichen – dokumentierte Zahlungsströme als Cash-Buchungen, die verbleibende FX-/Rundungsdifferenz als eine Ausgleichsbuchung.

### Automatisierung per Agent & Skill (Nutzung auf eigenes Risiko!)

Diese Nachbuchungen lassen sich mit einem Claude-Code-Agenten und dem Skill [`extraetf-import-ops`](.claude/skills/extraetf-import-ops/) automatisieren: Der Skill kennt die (verifizierten, aber versionsabhängigen) UI-Abläufe der ExtraETF-Web-App, der Agent steuert damit die Oberfläche per Browser-Automation und bucht, was der CSV-Import nicht abdeckt.

1. Der Konverter listet unter „Cash / Kontobuchungen" alle nicht-importierbaren Buchungen samt Ziel-Endbarsaldo.
2. Du meldest dich selbst bei app.extraetf.com an – der Agent hält keine Zugangsdaten.
3. Der Agent bucht per „Neue Aktivität → Cash" Ein-/Auszahlungen, Zinsen, Gebühren und Steuern, die Kupons als `Dividende` auf die jeweilige Anleihe und gleicht zuletzt das Verrechnungskonto auf den CapTrader-Endbarsaldo ab.
4. Nach jeder Buchung liest er den Wert zurück und prüft das Verrechnungskonto, bevor er weitermacht.

Der Agent arbeitet nur am angegebenen Depot, fragt vor jeder Buchung nach (sofern nicht freigegeben) und steuert ausschließlich die Oberfläche – kein direkter API- oder Token-Zugriff.

## Bekannte ExtraETF-Besonderheiten

Der Konverter erzeugt eine korrekte CSV; die folgenden Punkte liegen an ExtraETF:

- **Typ:** erkennt ExtraETF selbst anhand der ISIN; die CSV-Spalte ist nur ein Hinweis.
- **Fremdwährungs-Dividenden:** ExtraETF ignoriert den Wechselkurs bei Dividenden und bucht Preis/Steuern als EUR (`318 HKD` → `318 €`); Käufe und Verkäufe werden korrekt umgerechnet. Workaround: solche Dividenden in EUR buchen (`Währung=EUR`).
- **Split mit ISIN-Wechsel:** ExtraETF fügt einen nicht löschbaren „Split" ein und bewertet die neue Stückzahl mit dem Vor-Split-Kurs (Position überhöht). Manuelle Käufe/Einbuchungen werden nicht gespeichert – Position nur per CSV-Import (`Einbuchung`) anlegen.

## Lizenz

Siehe [`LICENSE`](LICENSE).
