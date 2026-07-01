# ExtraETF UI reference (companion to SKILL.md)

Exhaustive selectors, field IDs and click-by-click flows for app.extraetf.com. **Verified 2026-07 against a
live Angular SPA — point-in-time. Snapshot and verify each element before relying on it; re-derive if changed.**
Read `SKILL.md` first for the ground rules and durable method.

## App map
- `/de/accounts` — portfolio & Verrechnungskonto cards. Card ⋮ menu → **"Portfolio bearbeiten"** for settings.
- `/de/transactions` — transaction list. **Two tabs: "Wertpapier" (securities) and "Cash"** (`?tab=cash-transactions`).
  Cash bookings (Gutschrift/Abbuchung/Zinsen-Gebühren) appear ONLY on the Cash tab; the Wertpapier tab holds
  Kauf/Verkauf/Dividende/Einbuchung/Ausbuchung/Split.
- `/de/investments` — positions with live market values. `/de/dividends` — dividends.
- **Scope to one depot:** append `?view=depot_<depotId>` to the URL.
- **Filter to one security:** the "Wertpapier" filter → adds `?investmentId=<id>` (shows all its txns, any date).
- A portfolio has **two account ids**: a depot/securities id and a separate cash-account id (they differ by a
  small amount, e.g. `…257` depot / `…258` cash). Cash transactions belong to the cash id.

## Field IDs
**Cash form** (the "+" → Cash tab): `#inp_tx_date` (native `type=date`, set ISO `YYYY-MM-DD`),
`#inp_tx_amount` (Betrag — masked, real keystrokes), `#inp_tx_comment` (Kommentar, under "Mehr Optionen").
**Securities form** (Wertpapier tab): `#inp_investment_search`, `#inp_booking_date`,
`#inp_booking_number_of_lots` (Anzahl), `#inp_booking_entry_quote` (Kurs), `#inp_booking_amount` (auto),
`#inp_booking_commission`, `#inp_booking_tax_amount`, `#inp_booking_comment`.

## Toolbar buttons (top bar)
- **"+" Neue Aktivität** = `button[name="Neue Aktivität"]` (svg path `M16 4V28M28 16L4 16`). On pages with two,
  use `app-header button[name="Neue Aktivität"]`.
- **Datenimport** = `button[name="Datenimport"]` (svg path `M14 3C12.8954…`). The **adjacent `M13.6119…` icon is
  CSV EXPORT — do not click it** (it downloads a file). Then "Portfolio teilen", then "Privacy Mode".

## Dropdowns & dialogs
- Dropdown options = `button[role=menuitem].dropdown-item`. Prefer clicking a snapshot **ref**; if using a
  selector, scope it and verify state changed (evaluate-clicking option *text* can land on the table behind).
- Delete-confirm modal = `#cdk-dialog-*` containing "Transaktion löschen? … kann nicht rückgängig gemacht werden".
- Modal close (X) = `[data-testid="modal_close_button"]`.

## Booking a cash entry
1. `[+]` (`button[name="Neue Aktivität"]`). Dialog opens on **Wertpapiere** and closes after each Speichern.
2. Click the **Cash** tab: `button:text-is("Cash")` (real click).
3. TYP dropdown values: **Gutschrift (+)**, **Abbuchung (−)**, **Zinsen/Gebühren** (signed net: positive credit,
   negative debit; adds a Steuern field), **Steuererstattung**, **Dividenden**. Change it by clicking the trigger
   (`button` showing the current type) then the `.dropdown-item`.
4. Set `#inp_tx_date` (native-set ISO) and `#inp_tx_comment` (native-set; expand "Mehr Optionen" first), then
   **type** `#inp_tx_amount` with real keystrokes (German decimals; leading `-` allowed for Zinsen/Gebühren).
5. Read back TYP/date/amount/comment, then **Speichern** (`button:text-is("Speichern")`). Verify the
   Verrechnungskonto on `/de/accounts` after.

## Booking a securities transaction
`[+]` → (Wertpapiere tab is default) → type ISIN into `#inp_investment_search` → click the matching result
(`… <ISIN> · Aktie`) → set TYP → set `#inp_booking_date` (native), type `#inp_booking_number_of_lots` and
`#inp_booking_entry_quote` (Betrag auto-computes) → Speichern. Currency selector next to Kurs defaults to €.
(For a corp-action-locked security this silently fails — see bugs.)

## Deleting a transaction
Make the row visible (see "finding a row") → row's **⋮ action button** → **"Löschen"**
(`.dropdown-item:has-text("Löschen")`) → confirm **"Löschen"** in the `#cdk-dialog-*` modal. Not undoable except
by re-creating — record the exact values first. (When targeting by amount, sort by Betrag first so the intended
row is unambiguous.)

## Finding a row in the virtualized list
Only ~100 rows load, date-sorted desc. Surface a specific one via: the **Wertpapier filter** (one security),
the **Transaktionstyp filter** **+ set the time range to "Max"** (default "1 Jahr" hides older years), or click the
**Betrag column header** to sort by amount.

## CSV import
**Datenimport** (`button[name="Datenimport"]`) → **"CSV importieren"** → depot auto-selected from the view →
**"Datei auswählen"** (opens a file chooser → `browser_file_upload` with the absolute path) → preview → **Speichern**.
This is the only way to create Einbuchungen / positions for corp-action-locked securities.

## Portfolio settings — accounts card ⋮ → "Portfolio bearbeiten"
- **"Berücksichtigen"** (checkbox) — include the Verrechnungskonto in the total. Keep ON for full NAV.
- **"Negative Kontostände ausgleichen"** — auto-tops-up negative cash. ON hides the true clearing balance; turn
  **OFF** for a transparent, real Verrechnungskonto (it will swing to a large negative mid-reconciliation — expected).
- On the card, the icon next to the Verrechnungskonto value is an **include/exclude toggle** — don't click it by
  accident (it changes the card total). Use the edit dialog for the setting.

## Reconciling the Verrechnungskonto to a target
1. Turn OFF "Negative Kontostände ausgleichen".
2. Delete opaque "plug" cash entries.
3. Book the documented non-importable flows as labelled Cash entries (deposits/withdrawals = Gutschrift/Abbuchung;
   interest/withholding-tax/fees/accrued-interest = Zinsen/Gebühren, signed). Split by year or per actual movement if asked.
4. Measure the leftover and book one honest **"FX-Kursbewertung + Rundung"** balancer so the Verrechnungskonto
   equals the target to the cent. Book known one-offs (e.g. a corporate-action cash correction) as their own labelled entries.

## Known ExtraETF bugs — detail
### Foreign-currency dividends booked as EUR *(verified)*
CSV import ignores the `Wechselkurs` for `Transaktion=Dividende` and stores the native `Preis`/`Steuern` as EUR.
Observed by opening the stored Tencent dividend (`KYG875721634`): `Preis=318`, currency **€**, no Wechselkurs —
the CSV row was correct (`Preis=318;…;Währung=HKD;Wechselkurs=9,11577` → should be ≈ 34,88 €). `Kauf`/`Verkauf`
convert correctly, so it is specific to `Dividende`. Impact scales with the rate: HKD/NOK/SEK ~9–11× too high,
USD ≈ EUR (barely visible), GBP slightly under. Workaround: pre-convert those dividends to EUR in the CSV
(`Preis`/`Steuern` in EUR, `Währung=EUR`), or file the bug (a 2-3 row `Dividende` CSV in a foreign currency reproduces it).

### Split with ISIN change *(glitch verified; persistence inferred)*
Example: Kongsberg `NO0003043309` → `NO0013536151` (5:1). ExtraETF auto-inserts an **un-deletable "Split 1:5"**
on the new ISIN and values the post-split quantity at the **pre-split price** (position inflated). Attempts to
model it manually **did not persist**: a Kauf on either ISIN closed the dialog but created no transaction and left
the Verrechnungskonto unchanged (inferred: rejected by the corp-action engine); the booking dialog **locks TYP to
"Kauf"** for the new ISIN, so Einbuchung isn't selectable. The 125-share holding only exists because it was created
via **CSV import** of an `Einbuchung` row — that is how to (re)create/restore such a position. ExtraETF also
auto-reassigns pre-split dividends to the surviving ISIN.
