// generateXML.ts Version 7 - Verbesserte & ZKA 3.8-konforme Version
declare global {
  interface Window {
    vkbeautifyforZKA38: any;
  }
}

function getLocalISODateTimeString() {
  const date = new Date();
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  const pad = (n: number) => n.toString().padStart(2, '0');
  const ms = tzDate.getMilliseconds().toString().padStart(3, '0');
  return (
    tzDate.getFullYear() +
    '-' + pad(tzDate.getMonth() + 1) +
    '-' + pad(tzDate.getDate()) +
    'T' + pad(tzDate.getHours()) +
    ':' + pad(tzDate.getMinutes()) +
    ':' + pad(tzDate.getSeconds()) +
    '.' + ms
  );
}

export function generateXML(workbookData: any[], configData: any, showNotification?: (msg: string, type?: 'error'|'info'|'success'|'warning') => void, setXmlOutput?: (xml: string) => void) {
  if (!Array.isArray(workbookData) || !configData) {
    showNotification && showNotification('Bitte Excel-Datei zuerst laden.', 'error');
    return;
  }

  const validRows = workbookData.filter(row => {
    let betrag = parseFloat(String(row.Betrag).replace(',', '.'));
    return !isNaN(betrag) && betrag > 0;
  });

  if (validRows.length !== workbookData.length) {
    showNotification && showNotification('Fehler: Es sind Überweisungen mit Betrag 0,00, N/A oder leer enthalten. Korrigiere die Datei!', 'error');
    return;
  }
  if (!validRows.length) {
    showNotification && showNotification('Keine gültigen Überweisungen gefunden.', 'error');
    return;
  }

  const NS = "urn:iso:std:iso:20022:tech:xsd:pain.001.001.09";
  const xmlDoc = document.implementation.createDocument(NS, "", null);

  const root = xmlDoc.createElementNS(NS, "Document");
  root.setAttributeNS("http://www.w3.org/2001/XMLSchema-instance", "xsi:schemaLocation",
    "urn:iso:std:iso:20022:tech:xsd:pain.001.001.09 pain.001.001.09.zka38.xsd");
  xmlDoc.appendChild(root);

  const CstmrCdtTrfInitn = xmlDoc.createElementNS(NS, "CstmrCdtTrfInitn");
  root.appendChild(CstmrCdtTrfInitn);

  // --- Group Header ---
  CstmrCdtTrfInitn.appendChild(
    create("GrpHdr", [
      ["MsgId", configData.MSGID || "MSGID_MISSING"],
      ["CreDtTm", getLocalISODateTimeString()],
      ["NbOfTxs", validRows.length.toString()],
      ["CtrlSum", getTotalAmount(validRows).toFixed(2)],
      ["InitgPty", [["Nm", configData.AuftraggeberName || "Max Mustermann"]]]
    ])
  );

  // --- Payment Information ---
  CstmrCdtTrfInitn.appendChild(
    create("PmtInf", [
      ["PmtInfId", configData.MSGID || "MSGID_MISSING"],
      ["PmtMtd", "TRF"],
      ["BtchBookg", "true"],
      ["NbOfTxs", validRows.length.toString()],
      ["CtrlSum", getTotalAmount(validRows).toFixed(2)],
      ["PmtTpInf", [["SvcLvl", [["Cd", "SEPA"]]]]],
      ["ReqdExctnDt", [["Dt", getExecutionDate(validRows)]]],
      ["Dbtr", [["Nm", configData.AuftraggeberName || "AUFTRAGGEBER_FEHLT"]]],
      ["DbtrAcct", [["Id", [["IBAN", configData.AuftraggeberIBAN || "IBAN_FEHLT"]]]]],
      ["DbtrAgt", [["FinInstnId", [["BICFI", configData.AuftraggeberBIC || "NOTPROVIDED"]]]]],
      ["ChrgBr", "SLEV"],
      ...validRows.map((row, i) => {
        const betrag = parseFloat(String(row.Betrag).replace(',', '.')).toFixed(2);
        return [
          "CdtTrfTxInf", [
            ["PmtId", [["EndToEndId", row.EndToEndId || "ID" + (i + 1)]]],
            ["Amt", [["InstdAmt", betrag, { Ccy: "EUR" }]]],
            ...(row.BIC
              ? [["CdtrAgt", [["FinInstnId", [["BICFI", row.BIC.trim()]]]]]]
              : []
            ),
            ["Cdtr", [["Nm", row.Empfaenger || "EMPFÄNGER_FEHLT"]]],
            ["CdtrAcct", [["Id", [["IBAN", row.IBAN || "IBAN_FEHLT"]]]]],
            ["RmtInf", [["Ustrd", row.Verwendungszweck || ""]]]
          ]
        ];
      })
    ])
  );

  // --- Hilfsfunktionen ---
  function create(name: string, childrenOrText: any = "", attrs: Record<string, string> = {}) {
    const el = xmlDoc.createElementNS(NS, name);
    if (typeof childrenOrText === "string") {
      el.textContent = childrenOrText;
    } else if (Array.isArray(childrenOrText)) {
      childrenOrText.forEach((child: any) => {
        if (typeof child === "string") {
          el.appendChild(xmlDoc.createTextNode(child));
        } else if (Array.isArray(child)) {
          const [subName, subValue, subAttrs = {}] = child;
          const childEl = create(subName, subValue, subAttrs);
          el.appendChild(childEl);
        }
      });
    }
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  function getTotalAmount(rows: any[]) {
    return rows.reduce((sum, row) => sum + parseFloat(String(row.Betrag).replace(',', '.')), 0);
  }

  function getExecutionDate(rows: any[]) {
    let val = rows[0]?.Valuta;
    if (val && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    return new Date().toISOString().slice(0, 10);
  }

  // --- Ausgabe ins Textfeld (ZKA 3.8-konform!) ---
  const xmlString = new XMLSerializer().serializeToString(xmlDoc);
  if (setXmlOutput) {
    setXmlOutput(
      (window.vkbeautifyforZKA38 && typeof window.vkbeautifyforZKA38.xml === "function")
        ? window.vkbeautifyforZKA38.xml(xmlString)
        : xmlString
    );
  }
  if (showNotification) showNotification('XML erfolgreich generiert!', 'success');
}

export function formatXmlZka38(xml: string, showNotification?: (msg: string, type?: 'error'|'info'|'success'|'warning') => void) {
  if (window.vkbeautifyforZKA38 && typeof window.vkbeautifyforZKA38.xml_zka38 === "function") {
    return window.vkbeautifyforZKA38.xml_zka38(xml);
  } else {
    showNotification && showNotification("vkbeautifyforZKA38.js nicht geladen oder Funktion nicht vorhanden!", 'error');
    return xml;
  }
}

export function downloadXML(xmlContent: string, showNotification?: (msg: string, type?: 'error'|'info'|'success'|'warning') => void) {
  if (!xmlContent) {
    showNotification && showNotification('Kein XML zum Speichern vorhanden.', 'error');
    return;
  }
  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'pain.001.001.09.xml';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
