/**
 * ============================================================
 *  NexHack Certificate Generator — Google Apps Script
 * ============================================================
 *
 *  HOW TO USE
 *  ----------
 *  1. Open https://script.google.com  →  New Project
 *  2. Paste this entire file into Code.gs
 *  3. Fill in the SHEET_ID constant below (your Google Sheet ID)
 *  4. In the Sheet, make sure you have columns named exactly:
 *       "Member Name"  |  "Team Name"
 *     (case-sensitive, first row = header)
 *  5. Run  generateAllCertificates()
 *  6. On first run, authorize the requested scopes.
 *
 *  WHAT IT DOES (per row)
 *  ----------------------
 *  • Copies the Slides template
 *  • Replaces {{MEMBER_NAME}} and {{TEAM_NAME}} placeholders
 *  • Exports the copy as a PDF
 *  • Saves the PDF to your Drive folder
 *  • Deletes the temporary Slides copy
 *  • Writes "GENERATED" in a Status column so you can track progress
 *
 *  PLACEHOLDER FORMAT
 *  ------------------
 *  In your Google Slides template, use these exact text strings:
 *    {{MEMBER_NAME}}   — will be replaced with the participant's name
 *    {{TEAM_NAME}}     — will be replaced with the team name
 *  You can add more placeholders by editing the replacements object below.
 * ============================================================
 */

// ─── CONFIGURATION ──────────────────────────────────────────
const TEMPLATE_ID = '1IcWXAyV5dc_B9UOoPZ86WYSnRkgq6t8tUx3_wrKnghk';   // Google Slides template
const FOLDER_ID   = '1p8KYU5ldarei7C7f_BKUhNYNAFFcjcet';               // Drive folder for PDFs
const SHEET_ID    = '1NGGGqPcZYirHHO2l1JnqZ5tNgvF9O82XsC5rPCvRQKo';  // ← paste your Google Sheet ID here
// ─────────────────────────────────────────────────────────────


/**
 * Main entry point — generates certificates for every row in the sheet.
 */
function generateAllCertificates() {
  if (!SHEET_ID) {
    throw new Error('⛔ SHEET_ID is empty. Paste your Google Sheet ID into the SHEET_ID constant.');
  }

  const sheet  = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  const data   = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());

  // Locate columns
  const nameCol   = headers.indexOf('Member Name');
  const teamCol   = headers.indexOf('Team Name');

  if (nameCol === -1 || teamCol === -1) {
    throw new Error(
      '⛔ Could not find required columns. Make sure your sheet header row contains ' +
      '"Member Name" and "Team Name" (case-sensitive).'
    );
  }

  // Add a "Status" column if it doesn't exist
  let statusCol = headers.indexOf('Status');
  if (statusCol === -1) {
    statusCol = headers.length;
    sheet.getRange(1, statusCol + 1).setValue('Status');
  }

  const folder = DriveApp.getFolderById(FOLDER_ID);
  let generated = 0;
  let skipped   = 0;
  let failed    = 0;

  // Process each participant (skip header row)
  for (let i = 1; i < data.length; i++) {
    const memberName = String(data[i][nameCol] || '').trim();
    const teamName   = String(data[i][teamCol] || '').trim();

    if (!memberName) {
      Logger.log(`Row ${i + 1}: Skipped (empty name)`);
      skipped++;
      continue;
    }

    // Check if already generated
    const currentStatus = String(data[i][statusCol] || '').trim().toUpperCase();
    if (currentStatus === 'GENERATED' || currentStatus === 'SENT') {
      Logger.log(`Row ${i + 1}: Skipped "${memberName}" (status: ${currentStatus})`);
      skipped++;
      continue;
    }

    try {
      const pdfFile = generateCertificatePdf(memberName, teamName, folder);
      Logger.log(`Row ${i + 1}: ✅ Generated "${pdfFile.getName()}" for ${memberName}`);
      sheet.getRange(i + 1, statusCol + 1).setValue('GENERATED');
      generated++;
    } catch (err) {
      Logger.log(`Row ${i + 1}: ❌ FAILED for ${memberName} — ${err.message}`);
      sheet.getRange(i + 1, statusCol + 1).setValue('FAILED');
      failed++;
    }

    // Small delay to avoid hitting API rate limits
    Utilities.sleep(1500);
  }

  const summary = `\n🎉 Done!\n   Generated: ${generated}\n   Skipped:   ${skipped}\n   Failed:    ${failed}`;
  Logger.log(summary);

  SpreadsheetApp.getUi().alert(
    'Certificate Generation Complete',
    `Generated: ${generated}\nSkipped: ${skipped}\nFailed: ${failed}`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}


/**
 * Generates a single certificate PDF and saves it to the target folder.
 *
 * @param {string} memberName  — participant's full name
 * @param {string} teamName    — team name
 * @param {Folder} folder      — destination Drive folder
 * @returns {File}             — the created PDF file
 */
function generateCertificatePdf(memberName, teamName, folder) {
  // 1️⃣  Copy the template
  const templateFile = DriveApp.getFileById(TEMPLATE_ID);
  const tempCopy     = templateFile.makeCopy(`Certificate — ${memberName}`, folder);
  const tempCopyId   = tempCopy.getId();

  try {
    // 2️⃣  Open copy as a Presentation and replace placeholders
    const presentation = SlidesApp.openById(tempCopyId);
    const slides       = presentation.getSlides();

    // Define all placeholder → value mappings here
    const replacements = {
      '{{MEMBER_NAME}}': memberName,
      '{{TEAM_NAME}}':   teamName,
    };

    slides.forEach(slide => {
      slide.getShapes().forEach(shape => {
        if (shape.getText) {
          const textRange = shape.getText();
          for (const [placeholder, value] of Object.entries(replacements)) {
            textRange.replaceAllText(placeholder, value);
          }
        }
      });

      // Also check tables (some templates use them for layout)
      slide.getTables().forEach(table => {
        for (let r = 0; r < table.getNumRows(); r++) {
          for (let c = 0; c < table.getNumColumns(); c++) {
            const cell = table.getCell(r, c);
            for (const [placeholder, value] of Object.entries(replacements)) {
              cell.getText().replaceAllText(placeholder, value);
            }
          }
        }
      });
    });

    presentation.saveAndClose();

    // 3️⃣  Export the Slides copy as PDF
    const pdfBlob = exportSlidesAsPdf(tempCopyId);

    // 4️⃣  Create the PDF with the same naming convention as your Next.js app
    const pdfFileName = normalizeName(memberName, teamName);
    const pdfFile     = folder.createFile(pdfBlob.setName(pdfFileName));

    return pdfFile;

  } finally {
    // 5️⃣  Always clean up the temporary Slides copy
    DriveApp.getFileById(tempCopyId).setTrashed(true);
  }
}


/**
 * Exports a Google Slides presentation as a PDF blob.
 * Uses the Drive API export endpoint.
 */
function exportSlidesAsPdf(presentationId) {
  const url = `https://www.googleapis.com/drive/v3/files/${presentationId}/export?mimeType=application/pdf`;

  const response = UrlFetchApp.fetch(url, {
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
    },
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() !== 200) {
    throw new Error(`PDF export failed (HTTP ${response.getResponseCode()}): ${response.getContentText()}`);
  }

  return response.getBlob().setContentType('application/pdf');
}


/**
 * Normalizes a filename to match the convention used in your Next.js app:
 *   "John Doe" + "Team Alpha" → "johndoeteamalpha.pdf"
 */
function normalizeName(name, team) {
  const cleanName = name.replace(/\s+/g, '').toLowerCase();
  const cleanTeam = team.replace(/\s+/g, '').toLowerCase();
  return `${cleanName}${cleanTeam}.pdf`;
}


// ─── OPTIONAL: Menu in the Sheet UI ─────────────────────────
/**
 * Adds a custom menu when the Sheet is opened.
 * To use this, go to Extensions → Apps Script in your Sheet,
 * then paste this code there (instead of script.google.com).
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎓 Certificates')
    .addItem('Generate All Certificates', 'generateAllCertificates')
    .addItem('Generate Selected Row Only', 'generateSelectedRow')
    .addToUi();
}


/**
 * Generates a certificate for only the currently selected row.
 */
function generateSelectedRow() {
  const sheet     = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const row       = sheet.getActiveRange().getRow();
  const headers   = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const rowData   = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

  const nameCol   = headers.indexOf('Member Name');
  const teamCol   = headers.indexOf('Team Name');

  if (nameCol === -1 || teamCol === -1) {
    SpreadsheetApp.getUi().alert('Missing "Member Name" or "Team Name" columns.');
    return;
  }

  let statusCol = headers.indexOf('Status');
  if (statusCol === -1) {
    statusCol = headers.length;
    sheet.getRange(1, statusCol + 1).setValue('Status');
  }

  const memberName = String(rowData[nameCol] || '').trim();
  const teamName   = String(rowData[teamCol] || '').trim();

  if (!memberName) {
    SpreadsheetApp.getUi().alert('Selected row has no Member Name.');
    return;
  }

  const folder = DriveApp.getFolderById(FOLDER_ID);

  try {
    const pdfFile = generateCertificatePdf(memberName, teamName, folder);
    sheet.getRange(row, statusCol + 1).setValue('GENERATED');
    SpreadsheetApp.getUi().alert(`✅ Certificate generated!\n\nFile: ${pdfFile.getName()}`);
  } catch (err) {
    sheet.getRange(row, statusCol + 1).setValue('FAILED');
    SpreadsheetApp.getUi().alert(`❌ Failed: ${err.message}`);
  }
}
