// generateXML.ts - 100% ZKA 3.8-konform, keine Einrückung, alle Tags nach pain.001.001.09

export function getLocalISODateTimeString(): string {
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

export function generateXML(
  workbookData: any[],
  configData: any,
  outputElementId: string = 'xmlOutput'
): void {
  if (!Array.isArray(workbookData) || !configData) {
    alert('Bitte Excel-Datei zuerst laden.');
    return;
  }

  const validRows = workbookData.filter((row: any) => {
    let betrag = parseFloat(String(row.Betrag).replace(',', '.'));
    return !isNaN(betrag) && betrag > 0;
  });

  if (validRows.length !== workbookData.length) {
    alert("Fehler: Es sind Überweisungen mit Betrag 0,00, N/A oder leer enthalten. Korrigiere die Datei!");
    return;
  }
  if (!validRows.length) {
    alert("Keine gültigen Überweisungen gefunden.");
    return;
  }

  const NS = "urn:iso:std:iso:20022:tech:xsd:pain.001.001.09";
  const xmlDoc = document.implementation.createDocument(NS, "", null);

  // <Document>
  const root = xmlDoc.createElementNS(NS, "Document");
  root.setAttributeNS(
    "http://www.w3.org/2001/XMLSchema-instance",
    "xsi:schemaLocation",
    "urn:iso:std:iso:20022:tech:xsd:pain.001.001.09 pain.001.001.09.zka38.xsd"
  );
  xmlDoc.appendChild(root);

  // <CstmrCdtTrfInitn>
  const CstmrCdtTrfInitn = xmlDoc.createElementNS(NS, "CstmrCdtTrfInitn");
  root.appendChild(CstmrCdtTrfInitn);

  // --- Group Header ---
  CstmrCdtTrfInitn.appendChild(
    create(xmlDoc, NS, "GrpHdr", [
      ["MsgId", configData.MSGID || "MSGID_MISSING"],
      ["CreDtTm", getLocalISODateTimeString()],
      ["NbOfTxs", validRows.length.toString()],
      ["CtrlSum", getTotalAmount(validRows).toFixed(2)],
      ["InitgPty", [["Nm", configData.AuftraggeberName || "Max Mustermann"]]]
    ])
  );

  // --- Payment Information ---
  CstmrCdtTrfInitn.appendChild(
    create(xmlDoc, NS, "PmtInf", [
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
      ...validRows.map((row: any, i: number) => {
        const betrag = parseFloat(String(row.Betrag).replace(',', '.')).toFixed(2);
        return [
          "CdtTrfTxInf", [
            ["PmtId", [["EndToEndId", row.EndToEndId || `ID${i + 1}`]]],
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
  function create(
    xmlDoc: XMLDocument,
    NS: string,
    name: string,
    childrenOrText: any = "",
    attrs: Record<string, any> = {}
  ): Element {
    const el = xmlDoc.createElementNS(NS, name);
    if (typeof childrenOrText === "string") {
      el.textContent = childrenOrText;
    } else if (Array.isArray(childrenOrText)) {
      childrenOrText.forEach((child: any) => {
        if (typeof child === "string") {
          el.appendChild(xmlDoc.createTextNode(child));
        } else if (Array.isArray(child)) {
          const [subName, subValue, subAttrs = {}] = child;
          const childEl = create(xmlDoc, NS, subName, subValue, subAttrs);
          el.appendChild(childEl);
        }
      });
    }
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  function getTotalAmount(rows: any[]): number {
    return rows.reduce((sum: number, row: any) => sum + parseFloat(String(row.Betrag).replace(',', '.')), 0);
  }

  function getExecutionDate(rows: any[]): string {
    let val = rows[0]?.Valuta;
    if (val && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    return new Date().toISOString().slice(0, 10);
  }

  // --- Ausgabe ins Textfeld, keine Einrückung ---
  let xmlString = new XMLSerializer().serializeToString(xmlDoc);

  // Entferne jegliche Einrückung (alle Zeilenumbrüche und Tabs)
  xmlString = xmlString.replace(/>\s+</g, '><');

  const outputEl = document.getElementById(outputElementId) as HTMLTextAreaElement | null;
  if (outputEl) {
    outputEl.value = xmlString;
  }
}