import React, { useState } from "react";
import * as XLSX from "xlsx";

// --- Hilfsfunktionen ---
function zkaReplaceUmlauts(str: string): string {
  if (typeof str !== "string") return str;
  return str
    .replace(/Ä/g, "AE")
    .replace(/Ö/g, "OE")
    .replace(/Ü/g, "UE")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

function isValidIban(iban: string): boolean {
  iban = iban.replace(/\s+/g, '').toUpperCase();
  if (!/^DE\d{20}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numericIban = rearranged.replace(/[A-Z]/g, char => (char.charCodeAt(0) - 55).toString());
  let remainder = numericIban, block;
  while (remainder.length > 2) {
    block = remainder.slice(0, 9);
    remainder = (parseInt(block, 10) % 97).toString() + remainder.slice(block.length);
  }
  return parseInt(remainder, 10) % 97 === 1;
}

function getBLZfromDEIban(iban: string): string {
  return iban.replace(/\s+/g, '').substring(4, 12);
}

function isValidBIC(bic: string): boolean {
  return typeof bic === 'string' && /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic.trim());
}

function getBICCountry(bic: string): string {
  return bic.trim().substring(4, 6);
}

function generateXML(data: any[], config: any): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<SEPA>';
  data.forEach((row, i) => {
    xml += `\n  <Ueberweisung nr="${i + 1}">`;
    Object.entries(row).forEach(([k, v]) => {
      xml += `\n    <${k}>${String(v).replace(/[<>&]/g, '')}</${k}>`;
    });
    xml += "\n  </Ueberweisung>";
  });
  xml += "\n</SEPA>";
  return xml;
}

// --- Hauptkomponente ---
const App: React.FC = () => {
  const [workbookData, setWorkbookData] = useState<any[]>([]);
  const [configData, setConfigData] = useState<any | null>(null);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [xmlDoc, setXmlDoc] = useState<Document | null>(null);
  const [blzToBics, setBlzToBics] = useState<Record<string, any>>({});
  const [xmlOutput, setXmlOutput] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  const onBlzFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setMessage("Bitte die blzToBics.json auswählen.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        setBlzToBics(JSON.parse(event.target?.result as string));
        setMessage("blzToBics.json erfolgreich geladen!");
      } catch {
        setBlzToBics({});
        setMessage("Fehler beim Parsen der blzToBics.json!");
      }
    };
    reader.readAsText(file);
  };

  const onExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      if (!workbook.Sheets["Überweisungen"] || !workbook.Sheets["Konfiguration"]) {
        setWorkbookData([]);
        setConfigData(null);
        setTotalAmount(0);
        setMessage("Excel-Datei muss die Tabellen 'Überweisungen' und 'Konfiguration' enthalten.");
        e.target.value = "";
        return;
      }
      if (!blzToBics || Object.keys(blzToBics).length === 0) {
        setWorkbookData([]);
        setConfigData(null);
        setTotalAmount(0);
        setMessage("Bitte zuerst die blzToBics.json laden!");
        e.target.value = "";
        return;
      }
      let allRows = XLSX.utils.sheet_to_json(workbook.Sheets["Überweisungen"]);
      let errors: string[] = [];
      let bicCorrectedRows: number[] = [];
      let ibanValidCount = 0, ibanInvalidCount = 0, ibanSpaceCleanedCount = 0, umlautReplacedEmpfaengerCount = 0, umlautReplacedVwzCount = 0;

      for (let idx = 0; idx < allRows.length; idx++) {
        const row = allRows[idx] as any;
        const rowNum = idx + 2;
        if (row.Empfaenger) {
          const replaced = zkaReplaceUmlauts(row.Empfaenger);
          if (replaced !== row.Empfaenger) umlautReplacedEmpfaengerCount++;
          row.Empfaenger = replaced;
        }
        if (row.Verwendungszweck) {
          const replaced = zkaReplaceUmlauts(row.Verwendungszweck);
          if (replaced !== row.Verwendungszweck) umlautReplacedVwzCount++;
          row.Verwendungszweck = replaced;
        }
        const rawIban = String(row.IBAN || '');
        const cleanedIban = rawIban.replace(/\s+/g, '');
        if (rawIban !== cleanedIban && cleanedIban.startsWith("DE")) {
          ibanSpaceCleanedCount++;
          row.IBAN = cleanedIban;
        }
        const iban = cleanedIban;
        const blz = String(getBLZfromDEIban(iban));
        let bic = String(row.BIC || '').trim();
        let bicError = false;
        if (iban.substring(0,2) === "DE" && !isValidIban(iban)) {
          errors.push(`Zeile ${rowNum}: Ungültige deutsche IBAN-Prüfziffer (${row.IBAN})`);
          ibanInvalidCount++;
          continue;
        } else if (iban.substring(0,2) === "DE") {
          ibanValidCount++;
        }
        if (bic !== '') {
          const ibanCountry = iban.substring(0,2);
          if (!isValidBIC(bic)) {
            bicError = true;
          } else {
            const bicCountry = getBICCountry(bic);
            if (bicCountry !== ibanCountry) {
              bicError = true;
            }
          }
          if (ibanCountry === "DE") {
            if (bicError) {
              row.BIC = "";
              bicCorrectedRows.push(rowNum);
            } else if (getBICCountry(bic) === "DE" && blzToBics && Object.keys(blzToBics).length > 0) {
              const erlaubteBics =
                blzToBics[blz] && Array.isArray(blzToBics[blz].bics)
                  ? blzToBics[blz].bics.map((b: any) => String(b).trim())
                  : [];
              if (!erlaubteBics.includes(bic)) {
                row.BIC = "";
                bicCorrectedRows.push(rowNum);
              }
            }
          } else {
            if (bicError) {
              errors.push(`Zeile ${rowNum}: BIC (${bic}) passt nicht zum IBAN-Land (${ibanCountry}) oder ist ungültig. Datei muss korrigiert und neu geladen werden!`);
              setWorkbookData([]);
              setConfigData(null);
              setTotalAmount(0);
              setMessage("Fehler in Zeile " + rowNum + ": BIC für SEPA-Ausland fehlerhaft. Import abgebrochen. Bitte korrigieren und Datei neu laden!");
              e.target.value = "";
              return;
            }
          }
        }
      }

      let invalid = allRows.some((row: any) => {
        let betrag = parseFloat(String(row.Betrag).replace(',', '.'));
        return isNaN(betrag) || betrag <= 0;
      });

      if (invalid) {
        errors.push("Mindestens eine Überweisung mit Betrag 0,00, N/A oder leer.");
      }

      if (errors.length) {
        setWorkbookData([]);
        setConfigData(null);
        setTotalAmount(0);
        setMessage("Fehler beim Prüfen der Datei:\n" + errors.join('\n') +
          "\nKorrekte IBAN-Prüfziffern: " + ibanValidCount +
          "\nUngültige IBAN-Prüfziffern: " + ibanInvalidCount +
          "\nIBANs mit entfernten Leerzeichen (nur DE): " + ibanSpaceCleanedCount + 
          "\nEmpfaenger-Felder mit Umlautersetzung: " + umlautReplacedEmpfaengerCount +
          "\nVerwendungszweck-Felder mit Umlautersetzung: " + umlautReplacedVwzCount
        );
        e.target.value = "";
        return;
      }

      if (bicCorrectedRows.length > 0) {
        setMessage(
          "Hinweis: In folgenden Zeilen wurde die BIC entfernt und die Überweisung als IBANonly behandelt (nur DE):\n" +
          bicCorrectedRows.join(', ')
        );
      }

      setWorkbookData(allRows);
      setConfigData(XLSX.utils.sheet_to_json(workbook.Sheets["Konfiguration"])[0]);
      const total = allRows.reduce((sum: number, row: any) => {
        let betrag = parseFloat(String(row.Betrag).replace(',', '.'));
        return sum + (isNaN(betrag) ? 0 : betrag);
      }, 0);
      setTotalAmount(total);

      setMessage(
        'Datei geladen: ' +
        allRows.length +
        ' Überweisungen (IBAN/BIC geprüft, alle Beträge > 0,00)\n' +
        'Gesamtsumme: ' +
        total.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
        ' EUR\n' +
        'Korrekte IBAN-Prüfziffern: ' + ibanValidCount + '\n' +
        'Ungültige IBAN-Prüfziffern: ' + ibanInvalidCount + '\n' +
        'IBANs mit entfernten Leerzeichen (nur DE): ' + ibanSpaceCleanedCount + '\n' +
        'Empfaenger-Felder mit Umlautersetzung: ' + umlautReplacedEmpfaengerCount + '\n' +
        'Verwendungszweck-Felder mit Umlautersetzung: ' + umlautReplacedVwzCount
      );
    };
    reader.readAsArrayBuffer(file);
  };

  const onXmlFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const xmlStr = event.target?.result as string;
      setXmlOutput(xmlStr);
      try {
        const parsed = new window.DOMParser().parseFromString(xmlStr, "application/xml");
        if (
          parsed.getElementsByTagName('parsererror').length > 0 ||
          !parsed.getElementsByTagName('Document').length
        ) {
          setXmlDoc(null);
          setMessage('Ungültige oder fehlerhafte XML-Datei.');
          return;
        }
        setXmlDoc(parsed);
        setMessage('XML-Datei geladen.');
      } catch (err) {
        setXmlDoc(null);
        setMessage('Fehler beim Parsen der XML-Datei!');
      }
    };
    reader.readAsText(file);
  };

  const handleGenerateXML = () => {
    if (!workbookData.length || !configData) {
      setMessage("Bitte zuerst eine gültige Excel-Datei laden!");
      return;
    }
    const xml = generateXML(workbookData, configData);
    setXmlOutput(xml);
    setMessage("XML generiert.");
  };

  return (
    <div style={{ fontFamily: "sans-serif", margin: "2em", background: "#f9f9f9", color: "#333" }}>
      <h1>ZKA 3.8 SEPA Sammelüberweisung</h1>

      <p><b>BLZ-BIC-Datei (blzToBics.json) auswählen:</b></p>
      <input type="file" accept=".json" onChange={onBlzFileChange} />

      <p>
        Bitte eine Excel-Datei mit den Tabellen <strong>"Überweisungen"</strong> und <strong>"Konfiguration"</strong> auswählen:
      </p>
      <input type="file" accept=".xlsx" onChange={onExcelFileChange} />

      <p>Optional: Vorhandene XML-Datei laden für PDF-Protokoll:</p>
      <input type="file" accept=".xml" onChange={onXmlFileChange} />

      <div style={{ margin: "1em 0" }}>
        <button onClick={handleGenerateXML}>XML generieren</button>
        <button disabled>XML herunterladen</button>
        <button disabled>PDF-Protokoll</button>
        <button disabled>PDF aus XML</button>
        <button disabled>XML formatieren (ZKA3.8)</button>
      </div>

      <h2>Generiertes XML:</h2>
      <textarea value={xmlOutput} readOnly style={{ width: "100%", height: "300px", whiteSpace: "pre", fontFamily: "monospace", marginBottom: "1em" }} />

      {message && <div style={{ whiteSpace: "pre", color: "darkred", marginTop: "1em" }}>{message}</div>}
    </div>
  );
};

export default App;