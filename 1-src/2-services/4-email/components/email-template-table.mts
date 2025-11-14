/***********************************
 * Email Template Table Components *
 ***********************************/

import { EMAIL_COLOR, EMAIL_CONTENT_MAX_WIDTH, EMAIL_FONT_FAMILY, EMAIL_FONT_SIZE, getEmailLineHeight } from "../email-types.mjs";
import { htmlDetailTableRows, htmlTitle, htmlVerticalSpace } from "./email-template-components.mjs";

//Monospaced formatted table
export const textSummaryTable = (title:string, columnLabelList:string[], rowList:(string|number)[][], footerText:string[] = []):string => {
    const columnWidths = columnLabelList.map((_, i) => {
        const colValues = rowList.map(row => String(row[i] ?? ''));
        const maxRowLength = Math.max(...colValues.map(val => val.length));
        return Math.max(columnLabelList[i].length, maxRowLength);
    });

    return [`===== ${title} =====`,
        columnLabelList.map((cell, i) => String(cell).padEnd(columnWidths[i])).join(' | '),
        columnWidths.map(w => '-'.repeat(w)).join('-|-'),
        ...rowList.map(row => row.map((cell, i) => String(cell ?? '').padEnd(columnWidths[i])).join(' | ')),
        ...(footerText.length ? [...footerText] : [])
    ].join('\n');
}


//Columns are nested and labeled in each row
export const renderLabeledRowTable  = (title:string, columnLabelList:string[], rowList:(string|number)[][], footerText:string[] = []):string =>
    [`===== ${title} =====`,
    ...rowList.map(row => {
      const label = String(row[0]);
      const values = row.slice(1)
        .map((cell, i) => `${columnLabelList[i + 1]}: ${cell}`)
        .join(' | ');
      return `${label}\n  ${values}\n`;
    }),
    ...(footerText.length ? [...footerText] : [])
  ].join('\n') + '\n\n';



export const htmlSummaryTable=(title:string, columnLabelList:string[], rowList:(string|number)[][], details:[string, string][] = []):string=>
    `<table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation" align="center" style="margin:0 auto;">
        <tr>
            <td align="center" valign="top">
                <table max-width="${EMAIL_CONTENT_MAX_WIDTH}" border="0" cellspacing="0" cellpadding="0" class="full_width" role="presentation" align="center" style="margin:0 auto;">
                    <tr>
                        <td>
                            ${htmlTitle(title, 'center', EMAIL_COLOR.PRIMARY)}
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation" style="border-collapse:collapse;">
                                <thead>
                                    <tr style="background-color:${EMAIL_COLOR.ACCENT};">
                                        ${columnLabelList.map(label =>
                                            `<th align="left" style="font-family:${EMAIL_FONT_FAMILY.TITLE}; font-size:${EMAIL_FONT_SIZE.TITLE}; color:${EMAIL_COLOR.WHITE}; padding:6px 4px;">${label}</th>`
                                        ).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rowList.map((row, rowIndex) =>
                                        `<tr>
                                            ${row.map((cell, colIndex) =>
                                                `<td style="font-family: ${EMAIL_FONT_FAMILY.TEXT}; font-size: ${EMAIL_FONT_SIZE.TEXT}; 
                                                    font-weight: ${(colIndex === 0) ? 'bold' : 'normal'}; color: ${(colIndex === 0) ? EMAIL_COLOR.PRIMARY : EMAIL_COLOR.GRAY_DARK};
                                                    background-color: ${EMAIL_COLOR.TRANSPARENT}; padding:6px 4px; border-bottom:1px solid ${EMAIL_COLOR.WHITE}; ">${cell}</td>`
                                            ).join('')}
                                        </tr>`
                                    ).join('')}
                                    ${details.length ? htmlVerticalSpace(10) : ''}
                                    ${htmlDetailTableRows(details, columnLabelList.length)}
                                </tbody>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>`;

    
//Two COlumn Table
export const htmlSummaryPairList = (title:string, valueMap:Map<string, string | number>):string =>
    `<div style="width:100%; margin:0 auto; max-width:${EMAIL_CONTENT_MAX_WIDTH};">
        ${htmlTitle(title)}
        <table width="100%" border="0" cellspacing="0" cellpadding="4" role="presentation"
            style="border-collapse:collapse; font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.TEXT};
                   color:${EMAIL_COLOR.BLACK}; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.TEXT)};">
            ${Array.from(valueMap.entries()).map(([key, value]) =>
                `<tr>
                    <td align="left" valign="top" style="font-weight:bold; padding:4px 8px; color:${EMAIL_COLOR.BLACK};">${key}</td>
                    <td align="right" valign="top" style="padding:4px 8px; color:${EMAIL_COLOR.BLACK};">${value}</td>
                </tr>`
            ).join('\n')}
        </table>
    </div>`;
