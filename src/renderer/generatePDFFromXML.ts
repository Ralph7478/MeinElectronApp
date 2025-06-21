import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
pdfMake.vfs = pdfFonts.pdfMake.vfs;

function formatEuro(value) {
  let num = parseFloat(String(value).replace(',', '.'));
  if (isNaN(num)) num = 0;
  return num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatGermanDateTime(dateString) {
  let date = typeof dateString === "string" ? new Date(dateString) : dateString;
  const pad = n => n.toString().padStart(2, '0');
  return (
    pad(date.getDate()) + '.' +
    pad(date.getMonth() + 1) + '.' +
    date.getFullYear() + ' ' +
    pad(date.getHours()) + ':' +
    pad(date.getMinutes()) + ':' +
    pad(date.getSeconds())
  );
}

function formatGermanDate(dateString) {
  let date = typeof dateString === "string" ? new Date(dateString) : dateString;
  const pad = n => n.toString().padStart(2, '0');
  return (
    pad(date.getDate()) + '.' +
    pad(date.getMonth() + 1) + '.' +
    date.getFullYear()
  );
}

function splitVerwendungszweck(text) {
  if (!text) return "";
  text = text.slice(0, 140); // maximal 140 Zeichen
  const maxLength = 70;
  if (text.length <= maxLength) return text;
  let idx = text.lastIndexOf(' ', maxLength);
  if (idx === -1) idx = maxLength;
  return text.slice(0, idx) + '\n' + text.slice(idx).trim();
}

function formatEndToEndId(text) {
  return text ? text.slice(0, 35) : '';
}

function getXMLText(parent, tag) {
  if (!parent) return "";
  const el = parent.getElementsByTagName(tag)[0];
  return el ? el.textContent.trim() : '';
}

export function generatePDFFromXML(xmlString: string, showNotification?: (msg: string, type?: 'error'|'info'|'success'|'warning') => void, action: 'anzeigen' | 'herunterladen' = 'herunterladen') {
  if (!xmlString) {
    showNotification && showNotification('Bitte XML-Datei zuerst laden.', 'error');
    return;
  }
  let xmlDoc: Document;
  try {
    xmlDoc = new window.DOMParser().parseFromString(xmlString, "application/xml");
  } catch (e) {
    showNotification && showNotification('Fehler beim Parsen der XML-Datei.', 'error');
    return;
  }
  const grpHdr = xmlDoc.getElementsByTagName("GrpHdr")[0];
  const msgId = getXMLText(grpHdr, "MsgId");
  const creDtTm = getXMLText(grpHdr, "CreDtTm");

  const pmtInf = xmlDoc.getElementsByTagName("PmtInf")[0];
  const reqdExctnDt = getXMLText(pmtInf, "ReqdExctnDt");

  const dbtr = pmtInf.getElementsByTagName("Dbtr")[0];
  const auftraggeberName = getXMLText(dbtr, "Nm");

  const dbtrAcct = pmtInf.getElementsByTagName("DbtrAcct")[0];
  const auftraggeberIBAN = getXMLText(dbtrAcct, "IBAN");

  const dbtrAgt = pmtInf.getElementsByTagName("DbtrAgt")[0];
  const auftraggeberBIC = getXMLText(dbtrAgt, "BICFI");

  const txList = Array.from(xmlDoc.getElementsByTagName("CdtTrfTxInf"));

  let summe = 0;
  txList.forEach(tx => {
    const betrag = getXMLText(tx, "InstdAmt");
    summe += parseFloat(betrag.replace(',', '.')) || 0;
  });

  const header = [
    { text: 'Erfassungsprotokoll: Zahlungen', style: 'header', margin: [0, 0, 0, 5] },
    { text: `Sammler: ${msgId}`, style: 'subheader', margin: [0, 0, 0, 1] },
    { text: `Erfassung: ${creDtTm ? formatGermanDateTime(creDtTm) : formatGermanDateTime(new Date())}`, style: 'subheader', margin: [0, 0, 0, 1] },
    { text: `Valuta: ${reqdExctnDt ? formatGermanDate(reqdExctnDt) : formatGermanDate(new Date())}`, style: 'valuta', margin: [0, 0, 0, 1] },
    { text: `Auftraggeber: ${auftraggeberName}`, style: 'meta', margin: [0, 0, 0, 1] },
    { text: `IBAN: ${auftraggeberIBAN}`, style: 'meta', margin: [0, 0, 0, 1] },
    { text: `BIC: ${auftraggeberBIC}`, style: 'meta', margin: [0, 0, 0, 8] }
  ];

  const tableBody = [
    [
      { text: 'Nr.', style: 'tableHeader' },
      { text: 'Empfänger & IBAN', style: 'tableHeader' },
      { text: 'Verwendungszweck', style: 'tableHeader' },
      { text: 'EndToEndId', style: 'tableHeader' },
      { text: 'Betrag', style: 'tableHeader', alignment: 'right', margin: [0,0,12,0] }
    ]
  ];

  txList.forEach((tx, i) => {
    const empfaenger = getXMLText(tx.getElementsByTagName("Cdtr")[0], "Nm");
    const iban = getXMLText(tx.getElementsByTagName("CdtrAcct")[0], "IBAN");
    const bic = getXMLText(
      tx.getElementsByTagName("CdtrAgt")[0]?.getElementsByTagName("FinInstnId")[0],
      "BICFI"
    );
    const vwz = getXMLText(tx.getElementsByTagName("RmtInf")[0], "Ustrd");
    const endToEndId = getXMLText(tx.getElementsByTagName("PmtId")[0], "EndToEndId");
    const betrag = getXMLText(tx, "InstdAmt");
    const empfaengerIbanText = empfaenger + '\n' + iban + (bic ? ' ' + bic : '');
    tableBody.push([
      { text: (i + 1).toString(), style: 'tableCell' },
      { text: empfaengerIbanText, style: 'tableCell' },
      { text: splitVerwendungszweck(vwz), style: 'vwzCell' },
      { text: formatEndToEndId(endToEndId), style: 'tableCell' },
      { text: formatEuro(betrag), style: 'tableCell', alignment: 'right', margin: [0,0,12,0] }
    ]);
  });

  tableBody.push([
    { text: '', style: 'tableHeader' },
    { text: '', style: 'tableHeader' },
    { text: '', style: 'tableHeader' },
    { text: 'Summe:', style: 'tableHeader', alignment: 'right', margin: [0,0,12,0] },
    { text: formatEuro(summe), style: 'tableHeader', alignment: 'right', margin: [0,0,12,0] }
  ]);

  const docDefinition = {
    pageOrientation: 'landscape',
    pageSize: 'A4',
    pageMargins: [18, 30, 18, 25],
    footer: function(currentPage, pageCount) {
      const now = new Date();
      return {
        columns: [
          { text: `Erstellt: ${formatGermanDateTime(now)}`, alignment: 'left', fontSize: 7, margin: [4, 0, 0, 0] },
          { text: `Datei: Erfassungsprotokoll_${msgId || 'AUS_XML'}.pdf`, alignment: 'center', fontSize: 7 },
          { text: `Seite ${currentPage} von ${pageCount}`, alignment: 'right', fontSize: 7, margin: [0, 0, 4, 0] }
        ],
        margin: [18, 0, 18, 0]
      };
    },
    content: [
      ...header,
      {
        table: {
          headerRows: 1,
          widths: [22, 150, 210, 90, 101],
          body: tableBody
        },
        layout: 'lightHorizontalLines'
      }
    ],
    styles: {
      header: { fontSize: 12, bold: true },
      subheader: { fontSize: 9 },
      valuta: { fontSize: 8, bold: true },
      meta: { fontSize: 8, color: '#555' },
      tableHeader: { bold: true, fillColor: '#eeeeee', fontSize: 9 },
      tableCell: { fontSize: 8 },
      vwzCell: { fontSize: 8, lineHeight: 1.1 }
    }
  };

  if (action === 'anzeigen') {
    pdfMake.createPdf(docDefinition).open();
    showNotification && showNotification('PDF aus XML wird angezeigt.', 'success');
  } else {
    pdfMake.createPdf(docDefinition).download(`Erfassungsprotokoll_${msgId || 'AUS_XML'}.pdf`);
    showNotification && showNotification('PDF-Download aus XML gestartet.', 'success');
  }
}
