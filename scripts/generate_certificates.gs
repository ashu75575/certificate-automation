/**
 * ============================================================
 * NexHack 2.0 — Certificate Generator
 * ============================================================
 *
 * PURPOSE:
 * Generate personalized certificate PDFs and save them to
 * a Google Drive folder.
 *
 * IMPORTANT:
 * This script ONLY generates certificates.
 *
 * It DOES NOT:
 * - Send emails
 * - Validate email addresses
 * - Update the Google Sheet
 * - Change participant status
 * - Modify participant data
 *
 *
 * SHEET COLUMNS:
 *   Team Name
 *   Member Name
 *   Member Email
 *   Member Phone Number
 *   Status
 *
 *
 * TEMPLATE PLACEHOLDER:
 *   {{ParticipantName}}
 *
 *
 * OUTPUT FILENAME:
 *   {memberName}{teamName}.pdf
 *
 * Example:
 *
 *   Member Name: Danvir Js
 *   Team Name:   PIXEL THINGS
 *
 *   Output:
 *   danvirjspixelthings.pdf
 * ============================================================
 */


// ============================================================
// CONFIGURATION
// ============================================================

const TEMPLATE_ID =
  '1h22vkEb........';

const FOLDER_ID =
  '1aKV8bV6........';

const SHEET_ID =
  '1ACsnTxP........';


// ============================================================
// MAIN FUNCTION
// ============================================================

function generateAllCertificates() {

  if (!SHEET_ID) {
    throw new Error(
      'SHEET_ID is empty.'
    );
  }


  // ----------------------------------------------------------
  // Open spreadsheet
  // ----------------------------------------------------------

  const sheet =
    SpreadsheetApp
      .openById(SHEET_ID)
      .getSheets()[0];


  const data =
    sheet
      .getDataRange()
      .getValues();


  if (data.length < 2) {
    throw new Error(
      'No participant data found.'
    );
  }


  // ----------------------------------------------------------
  // Read headers
  // ----------------------------------------------------------

  const headers =
    data[0].map(header =>
      String(header).trim()
    );


  const nameCol =
    headers.indexOf('Member Name');

  const teamCol =
    headers.indexOf('Team Name');

  const statusCol =
    headers.indexOf('Status');


  if (nameCol === -1) {
    throw new Error(
      'Could not find "Member Name" column.'
    );
  }


  if (teamCol === -1) {
    throw new Error(
      'Could not find "Team Name" column.'
    );
  }


  if (statusCol === -1) {
    throw new Error(
      'Could not find "Status" column.'
    );
  }


  // ----------------------------------------------------------
  // Get destination Drive folder
  // ----------------------------------------------------------

  const folder =
    DriveApp.getFolderById(FOLDER_ID);


  let generated = 0;
  let skippedByStatus = 0;
  let skippedExisting = 0;
  let skippedEmptyName = 0;
  let failed = 0;


  // ==========================================================
  // PROCESS PARTICIPANTS
  // ==========================================================

  for (
    let i = 1;
    i < data.length;
    i++
  ) {

    const memberName =
      String(
        data[i][nameCol] || ''
      ).trim();


    const teamName =
      String(
        data[i][teamCol] || ''
      ).trim();


    const currentStatus =
      String(
        data[i][statusCol] || ''
      )
        .trim()
        .toUpperCase();


    // ========================================================
    // 1. EMPTY NAME
    // ========================================================

    if (!memberName) {

      Logger.log(
        `Row ${i + 1}: Skipped — empty Member Name`
      );

      skippedEmptyName++;

      continue;
    }


    // ========================================================
    // 2. STATUS CHECK
    // ========================================================
    //
    // IMPORTANT:
    //
    // SENT   → NEVER generate
    // FAILED → NEVER generate
    //
    // The Sheet is ONLY READ.
    // Nothing is written back to it.
    //

    if (
      currentStatus === 'SENT' ||
      currentStatus === 'FAILED'
    ) {

      Logger.log(
        `Row ${i + 1}: Skipped "${memberName}" — status: ${currentStatus}`
      );

      skippedByStatus++;

      continue;
    }


    // ========================================================
    // 3. CHECK WHETHER CERTIFICATE ALREADY EXISTS
    // ========================================================
    //
    // This protects against duplicate certificates.
    //
    // Example:
    //
    // danvirjspixelthings.pdf already exists
    //
    // → Do NOT generate another one.
    //

    const existingFile =
      findExistingCertificate(
        memberName,
        teamName,
        folder
      );


    if (existingFile) {

      Logger.log(
        `Row ${i + 1}: Certificate already exists for "${memberName}" — ${existingFile.getName()}`
      );

      skippedExisting++;

      continue;
    }


    // ========================================================
    // 4. GENERATE CERTIFICATE
    // ========================================================

    try {

      const pdfFile =
        generateCertificatePdf(
          memberName,
          teamName,
          folder
        );


      Logger.log(
        `Row ${i + 1}: Generated "${pdfFile.getName()}" for "${memberName}"`
      );


      generated++;


    } catch (error) {

      Logger.log(
        `Row ${i + 1}: FAILED to generate certificate for "${memberName}" — ${error.message}`
      );


      failed++;
    }


    // Small delay between generations
    // to reduce the chance of Google API rate limiting.
    Utilities.sleep(1500);
  }


  // ==========================================================
  // SUMMARY
  // ==========================================================

  const summary =
    `Generated: ${generated}\n` +
    `Skipped (SENT/FAILED): ${skippedByStatus}\n` +
    `Skipped (already exists): ${skippedExisting}\n` +
    `Skipped (empty name): ${skippedEmptyName}\n` +
    `Failed: ${failed}`;


  Logger.log(
    '========================================'
  );

  Logger.log(
    'Certificate generation complete'
  );

  Logger.log(summary);

  Logger.log(
    '========================================'
  );


  SpreadsheetApp
    .getUi()
    .alert(
      'Certificate Generation Complete',
      summary,
      SpreadsheetApp
        .getUi()
        .ButtonSet.OK
    );
}


// ============================================================
// FIND EXISTING CERTIFICATE
// ============================================================

function findExistingCertificate(
  memberName,
  teamName,
  folder
) {

  const fileName =
    normalizeCertificateFilename(
      memberName,
      teamName
    );


  const files =
    folder.getFilesByName(fileName);


  if (files.hasNext()) {
    return files.next();
  }


  return null;
}


// ============================================================
// GENERATE SINGLE CERTIFICATE
// ============================================================

function generateCertificatePdf(
  memberName,
  teamName,
  folder
) {

  // ----------------------------------------------------------
  // Get template
  // ----------------------------------------------------------

  const templateFile =
    DriveApp.getFileById(
      TEMPLATE_ID
    );


  // ----------------------------------------------------------
  // Create temporary Slides copy
  // ----------------------------------------------------------

  const temporaryCopy =
    templateFile.makeCopy(
      `Certificate — ${memberName}`,
      folder
    );


  const temporaryCopyId =
    temporaryCopy.getId();


  try {

    // --------------------------------------------------------
    // Open temporary presentation
    // --------------------------------------------------------

    const presentation =
      SlidesApp.openById(
        temporaryCopyId
      );


    const slides =
      presentation.getSlides();


    // --------------------------------------------------------
    // Replace participant name
    // --------------------------------------------------------

    slides.forEach(slide => {

      // ------------------------------------------------------
      // Shapes
      // ------------------------------------------------------

      slide
        .getShapes()
        .forEach(shape => {

          if (shape.getText) {

            shape
              .getText()
              .replaceAllText(
                '{{ParticipantName}}',
                memberName
              );
          }
        });


      // ------------------------------------------------------
      // Tables
      // ------------------------------------------------------

      slide
        .getTables()
        .forEach(table => {

          for (
            let row = 0;
            row < table.getNumRows();
            row++
          ) {

            for (
              let column = 0;
              column < table.getNumColumns();
              column++
            ) {

              table
                .getCell(row, column)
                .getText()
                .replaceAllText(
                  '{{ParticipantName}}',
                  memberName
                );
            }
          }
        });
    });


    // --------------------------------------------------------
    // Save presentation
    // --------------------------------------------------------

    presentation.saveAndClose();


    // --------------------------------------------------------
    // Export as PDF
    // --------------------------------------------------------

    const pdfBlob =
      exportSlidesAsPdf(
        temporaryCopyId
      );


    // --------------------------------------------------------
    // Generate final filename
    // --------------------------------------------------------

    const pdfFileName =
      normalizeCertificateFilename(
        memberName,
        teamName
      );


    // --------------------------------------------------------
    // Save PDF
    // --------------------------------------------------------

    const pdfFile =
      folder.createFile(
        pdfBlob.setName(
          pdfFileName
        )
      );


    return pdfFile;


  } finally {

    // --------------------------------------------------------
    // Delete temporary Slides copy
    // --------------------------------------------------------
    //
    // This DOES NOT delete the generated PDF.
    //
    // It only removes the temporary Google Slides
    // presentation used to generate the PDF.
    //

    DriveApp
      .getFileById(
        temporaryCopyId
      )
      .setTrashed(true);
  }
}


// ============================================================
// EXPORT GOOGLE SLIDES AS PDF
// ============================================================

function exportSlidesAsPdf(
  presentationId
) {

  const url =
    `https://www.googleapis.com/drive/v3/files/` +
    `${presentationId}/export?mimeType=application/pdf`;


  const response =
    UrlFetchApp.fetch(
      url,
      {
        headers: {
          Authorization:
            'Bearer ' +
            ScriptApp.getOAuthToken()
        },

        muteHttpExceptions: true
      }
    );


  const responseCode =
    response.getResponseCode();


  if (responseCode !== 200) {

    throw new Error(
      `PDF export failed. HTTP ${responseCode}: ` +
      response.getContentText()
    );
  }


  return response
    .getBlob()
    .setContentType(
      'application/pdf'
    );
}


// ============================================================
// CERTIFICATE FILENAME
// ============================================================

/**
 * Converts:
 *
 *   Danvir Js
 *   PIXEL THINGS
 *
 * Into:
 *
 *   danvirjspixelthings.pdf
 */

function normalizeCertificateFilename(
  memberName,
  teamName
) {

  const cleanName =
    normalizeTextForFilename(
      memberName
    );


  const cleanTeam =
    normalizeTextForFilename(
      teamName
    );


  return (
    `${cleanName}${cleanTeam}.pdf`
  );
}


// ============================================================
// NORMALIZE FILENAME
// ============================================================

function normalizeTextForFilename(
  text
) {

  return String(text)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}


// ============================================================
// GOOGLE SHEETS MENU
// ============================================================

function onOpen() {

  SpreadsheetApp
    .getUi()
    .createMenu('🎓 Certificates')
    .addItem(
      'Generate All Certificates',
      'generateAllCertificates'
    )
    .addToUi();
}
