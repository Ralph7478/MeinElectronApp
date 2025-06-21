// generateXML.js – ZKA 3.8 konform (inkl. .trim(), MEZ/MESZ, IBAN-only, vkbeautify)
function getLocalISODateTimeString() {
  const date = new Date();
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  const pad = n => n.toString().padStart(2, '0');
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

function generateXML() {
  if (!Array.isArray(workbookData) || !configData) {
    alert('Bitte Excel-Datei zuerst laden.');
    return;
  }

  const validRows = workbookData.filter(row => {
    const betrag = parseFloat(String(row.Betrag).replace(',', '.'));
    return !isNaN(betrag) && betrag > 0;
  });

  if (!validRows.length) {
    alert("Keine gültigen Überweisungen vorhanden.");
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

  const executionDate = getExecutionDate(validRows);
  const totalAmount = getTotalAmount(validRows).toFixed(2);
  const msgId = (configData.MSGID || 'MSGID_MISSING').trim();
  const creationTime = getLocalISODateTimeString();

  // --- GrpHdr ---
  CstmrCdtTrfInitn.appendChild(create("GrpHdr", [
    ["MsgId", msgId],
    ["CreDtTm", creationTime],
    ["NbOfTxs", validRows.length.toString()],
    ["CtrlSum", totalAmount],
    ["InitgPty", [["Nm", (configData.AuftraggeberName || "INITIATOR").trim()]]]
  ]));

  // --- PmtInf ---
  const pmtChildren = [
    ["PmtInfId", msgId],
    ["PmtMtd", "TRF"],
    ["BtchBookg", "true"],
    ["NbOfTxs", validRows.length.toString()],
    ["CtrlSum", totalAmount],
    ["PmtTpInf", [["SvcLvl", [["Cd", "SEPA"]]]]],
    ["ReqdExctnDt", [["Dt", executionDate]]],
    ["Dbtr", [["Nm", (configData.AuftraggeberName || "INITIATOR").trim()]]],
    ["DbtrAcct", [["Id", [["IBAN", (configData.AuftraggeberIBAN || "IBAN_FEHLT").trim()]]]]],
    ["DbtrAgt", [["FinInstnId", [["BICFI", (configData.AuftraggeberBIC || "NOTPROVIDED").trim()]]]]],
    ["ChrgBr", "SLEV"]
  ];

  // --- Transaktionen ---
  validRows.forEach((row, i) => {
    const betrag = parseFloat(String(row.Betrag).replace(',', '.')).toFixed(2);
    const tx = [
      ["PmtId", [["EndToEndId", (row.EndToEndId || ("ID" + (i + 1))).trim()]]],
      ["Amt", [["InstdAmt", betrag, { Ccy: "EUR" }]]]
    ];

    if (row.BIC && row.BIC.trim() !== "") {
      tx.push(["CdtrAgt", [["FinInstnId", [["BICFI", row.BIC.trim()]]]]]);
    }

    tx.push(["Cdtr", [["Nm", (row.Empfaenger || "EMPFÄNGER_FEHLT").trim()]]]);
    tx.push(["CdtrAcct", [["Id", [["IBAN", (row.IBAN || "IBAN_FEHLT").replace(/\s+/g, '').trim()]]]]]);
    tx.push(["RmtInf", [["Ustrd", (row.Verwendungszweck || "").trim()]]]);

    pmtChildren.push(["CdtTrfTxInf", tx]);
  });

  CstmrCdtTrfInitn.appendChild(create("PmtInf", pmtChildren));

  // --- XML Serialisierung ---
  const xmlString = new XMLSerializer().serializeToString(xmlDoc);
  document.getElementById('xmlOutput').value =
    (window.vkbeautifyforZKA38 && typeof window.vkbeautifyforZKA38.xml === "function")
      ? window.vkbeautifyforZKA38.xml(xmlString)
      : xmlString;
}

// --- Hilfsfunktionen ---
function create(name, childrenOrText = "", attrs = {}) {
  const NS = "urn:iso:std:iso:20022:tech:xsd:pain.001.001.09";
  const el = document.createElementNS(NS, name);
  if (typeof childrenOrText === "string") {
    el.textContent = childrenOrText.trim();
  } else if (Array.isArray(childrenOrText)) {
    childrenOrText.forEach(child => {
      if (typeof child === "string") {
        el.appendChild(document.createTextNode(child.trim()));
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

function getExecutionDate(rows) {
  const val = rows[0]?.Valuta;
  return (val && /^\d{4}-\d{2}-\d{2}$/.test(val)) ? val : new Date().toISOString().slice(0, 10);
}

function getTotalAmount(rows) {
  return rows.reduce((sum, row) => sum + parseFloat(String(row.Betrag).replace(',', '.')), 0);
}

function downloadXML() {
  const xmlContent = document.getElementById('xmlOutput').value;
  if (!xmlContent) {
    alert("Kein XML zum Speichern vorhanden.");
    return;
  }
  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'pain.001.001.09.xml';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
