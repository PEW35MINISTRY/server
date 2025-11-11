import { EMAIL_COLOR, EMAIL_CONTENT_MAX_WIDTH, EMAIL_FONT_FAMILY, EMAIL_FONT_SIZE, getEmailLineHeight, getEmailListIndent, getNumericFontSize } from "../email-types.mjs";


/**************************
* GENERAL BODY COMPONENTS *
***************************/  
export const htmlSection = (text:string, textAlign:'left'|'center'|'right' = 'center'):string => htmlVerticalSpace(30) +
    `<div align="${textAlign}" style="width:100%; padding:${getNumericFontSize(EMAIL_FONT_SIZE.SECTION) * 2}px auto ${getNumericFontSize(EMAIL_FONT_SIZE.SECTION)}px auto;">
        <div style="display:inline-block; width:80%; text-align:${textAlign}; font-family:${EMAIL_FONT_FAMILY.SECTION}; font-size:${EMAIL_FONT_SIZE.SECTION}; color:${EMAIL_COLOR.PRIMARY}; font-weight:bold; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.SECTION, 1.5)}; padding: 0px; border-bottom:1px solid ${EMAIL_COLOR.PRIMARY};">${text}</div></div>`;

export const htmlTitle = (text:string, textAlign:'left'|'center'|'right' = 'left', fontColor:EMAIL_COLOR = EMAIL_COLOR.ACCENT):string => `<div style="width:100%; text-align:${textAlign}; font-family:${EMAIL_FONT_FAMILY.TITLE}; font-size:${EMAIL_FONT_SIZE.TITLE}; color:${fontColor}; font-weight:bold; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.TITLE, 2)};">${text}</div>`;

export const htmlText = (text:string, title?:string, textAlign:'left'|'center'|'right' = 'left'):string => `${title ? htmlTitle(title) : ''}<div style="width:100%; text-align:${textAlign}; margin:${EMAIL_FONT_SIZE.TEXT} 0px; font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.TEXT}; color:${EMAIL_COLOR.BLACK}; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.TEXT)};">${text}</div>`;

export const htmlDetailList=(details:[string, string][], title?:string):string=>`${title ? htmlTitle(title) : ''}${details.map(([label, text])=>`<div style="font-family:${EMAIL_FONT_FAMILY.DETAIL}; font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.BLACK}; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.DETAIL)}; text-align:left; margin:2px 0;"><strong>${label}</strong> ${text}</div>`).join('')}`;

export const htmlVerticalSpace = (pixel:number, color:string = EMAIL_COLOR.TRANSPARENT):string => `<div style="width:100%; height:${pixel}px; background-color:${color}; line-height:${pixel}px;">&nbsp;</div>`;

export const htmlActionButton=(buttons:{label:string, link:string, style?:'PRIMARY'|'ACCENT'|'OUTLINE'}[], title?:string, textAlign:'left'|'center'|'right' = 'center'):string =>
    `<div style="width:100%; text-align:${textAlign};">
        ${title ? htmlTitle(title, 'center') : ''}
        ${buttons.map((button, index)=>{
            const position = buttons.length - index;
            const buttonStyle = button.style || ((position === 1) ? 'PRIMARY' : (position === 2) ? 'ACCENT' : 'OUTLINE');
            let style = '';
            switch(buttonStyle) {
                case 'PRIMARY':
                    style = `background-color:${EMAIL_COLOR.PRIMARY}; color:${EMAIL_COLOR.WHITE}; border:2px solid ${EMAIL_COLOR.RED};`;
                    break;
                case 'ACCENT':
                    style = `background-color:${EMAIL_COLOR.ACCENT}; color:${EMAIL_COLOR.WHITE}; border:2px solid ${EMAIL_COLOR.BLUE};`;
                    break;
                case 'OUTLINE':
                    style = `background-color:${EMAIL_COLOR.WHITE}; color:${EMAIL_COLOR.BLUE}; border:2px solid ${EMAIL_COLOR.BLUE};`;
                    break;
            }

            return `<a href="${button.link}" style="display:inline-block; margin:6px; padding:10px 18px; border-radius:4px; font-family:${EMAIL_FONT_FAMILY.TITLE}; font-size:${EMAIL_FONT_SIZE.TITLE}; font-weight:bold; text-decoration:none; ${style}">${button.label}</a>`;
        }).join('')}
    </div>`;


export const htmlHeader = (greeting?:string):string =>
    `<table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation" >
        <tr>
            <td align="center" valign="middle" style="padding:10px 0;">
                <table border="0" cellspacing="0" cellpadding="0" role="presentation" style="padding-bottom:20px;">
                    <tr>
                        <td align="right" valign="middle">
                            <img src="https://ep-cdn-data-prod.s3.us-east-2.amazonaws.com/assets/images/brand/logo.png" alt="Encouraging Prayer Logo" height="${getNumericFontSize(EMAIL_FONT_SIZE.HEADER)}" style="margin-right:10px;">
                        </td>
                        <td align="left" valign="middle"
                            style="font-family:${EMAIL_FONT_FAMILY.HEADER}; font-size:${EMAIL_FONT_SIZE.HEADER}; color:${EMAIL_COLOR.PRIMARY}; font-weight:bold; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.HEADER)};">
                            Encouraging Prayer
                        </td>
                    </tr>
                </table>
                ${greeting ? `<div style="font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.TEXT}; color:${EMAIL_COLOR.BLACK}; text-align:left; margin-top:15px;">${greeting}</div>` : ''}
            </td>
        </tr>
    </table>`;


export const htmlFooter = (signatureLines?:string[]):string =>
    `<table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation" style="padding-top:20px;">
        <tr>
            <td align="left" valign="top" style="padding:0;">
                    ${signatureLines ? 
                        `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                            ${[...signatureLines, '&nbsp;'].map((line) =>
                                `<tr>
                                    <td align="left" style="font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.TEXT}; color:${EMAIL_COLOR.BLACK}; padding:0;">
                                        ${line.trim() ? line : '&nbsp;'}
                                    </td>
                                </tr>`
                            ).join('')}
                           </table>`
                        : ''}
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation" style="background-color:${EMAIL_COLOR.PRIMARY}; padding:20px 100px;">
                    <tr>
                        <td align="center" valign="middle">
                            <img src="https://ep-cdn-data-prod.s3.us-east-2.amazonaws.com/assets/images/brand/logo.png" alt="Encouraging Prayer Logo" height="${getNumericFontSize(EMAIL_FONT_SIZE.HEADER)}" style="display:block; margin:0 auto 8px auto;">
                            <div style="font-family:${EMAIL_FONT_FAMILY.TITLE}; font-size:${EMAIL_FONT_SIZE.TEXT}; ">
                                <a href="https://encouragingprayer.org/" style="color:${EMAIL_COLOR.WHITE}; text-decoration:none; margin:0 8px;">Website</a> |
                                <a href="https://pew35.org/" style="color:${EMAIL_COLOR.WHITE}; text-decoration:none; margin:0 8px;">PEW35 Ministry</a> |
                                <a href="mailto:support@encouragingprayer.org" style="color:${EMAIL_COLOR.WHITE}; text-decoration:none; margin:0 8px;">Support</a>
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>`;



export const htmlSummaryPairList = (title:string, valueMap:Map<string, string | number>):string =>
    `<div style="width:100%; margin:0 auto;">
        ${htmlTitle(title)}
        <table width="100%" border="0" cellspacing="0" cellpadding="4" role="presentation"
            style="border-collapse:collapse; font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.TEXT};
                   color:${EMAIL_COLOR.GRAY_DARK}; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.TEXT)};">
            ${Array.from(valueMap.entries()).map(([key, value]) =>
                `<tr>
                    <td align="left" valign="top" style="font-weight:bold; padding:4px 8px; color:${EMAIL_COLOR.BLUE_DARK};">${key}</td>
                    <td align="left" valign="top" style="padding:4px 8px; color:${EMAIL_COLOR.GRAY_DARK};">${value}</td>
                </tr>`
            ).join('\n')}
        </table>
    </div>`;

type StringList = (string | StringList)[];

export const htmlBulletList = (list:StringList, title?:string):string => `${title ? htmlTitle(title) : ''}${htmlList(list, 'BULLET')}`;

export const htmlNumberedList = (list:StringList, title?:string):string => `${title ? htmlTitle(title) : ''}${htmlList(list, 'NUMBER')}`;

const htmlList=(items:StringList, mode:'BULLET' | 'NUMBER'):string => {
    const bulletSymbols:string[] = ['disc', 'square', 'circle'];
    const numberSymbols:string[] = ['1', 'A', 'I', 'a', 'i'];

    const render = (list:StringList, level=0):string => {
        const htmlParts:string[] = [];

        list.forEach(item => {
            if(Array.isArray(item)){
                if (htmlParts.length === 0)
                    htmlParts.push(`<li>${render(item, level + 1)}</li>`);
                else {
                    const last = htmlParts.pop();
                    htmlParts.push(last.replace(/<\/li>$/, `${render(item, level + 1)}</li>`));
                }
            } else 
                htmlParts.push(`<li style="list-style-position:inside; margin:0; padding-left:${getEmailListIndent(level)}; font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.TEXT}; color:${EMAIL_COLOR.BLACK}; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.TEXT)};">${item}</li>`);
        });

        if(mode === 'NUMBER') {
            const type = numberSymbols[level % numberSymbols.length];
            const attrs = type !== '1' ? ` type="${type}"` : '';
            return `<ol${attrs} style="margin:0; padding-left:20px; font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.TEXT}; color:${EMAIL_COLOR.BLACK}; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.TEXT)};">${htmlParts.join('')}</ol>`;
        } else {
            const symbol = bulletSymbols[level % bulletSymbols.length];
            return `<ul style="list-style-type:${symbol}; margin:0; padding-left:20px; font-family:${EMAIL_FONT_FAMILY.TEXT}; font-size:${EMAIL_FONT_SIZE.TEXT}; color:${EMAIL_COLOR.BLACK}; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.TEXT)};">${htmlParts.join('')}</ul>`;
        }
    };

    return `<div style="text-align:left;">${render(items, 0)}</div>`;
};


export const htmlAccessCode=(code:number|string, title?:string):string=>{
    const digits:string[] = String(code).split('');
    const boxes:string = digits.map(d => 
        `<span style="display:inline-block; margin:20px 6px; padding:10px 14px; border:2px solid ${EMAIL_COLOR.ACCENT}; border-radius:6px; min-width:28px; text-align:center; font-family:${EMAIL_FONT_FAMILY.SECTION}; font-size:${EMAIL_FONT_SIZE.SECTION}; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.SECTION)}; font-weight:bold; color:${EMAIL_COLOR.BLACK};">${d}</span>`
    ).join('');
    
    return `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" align="center" style="width:100%; max-width:${EMAIL_CONTENT_MAX_WIDTH}; margin:0 auto; border-collapse:collapse;">
                <tr>
                    <td align="center" style="text-align:center; padding:0; color-scheme:light dark;">
                        ${title ? htmlTitle(title) : ''}
                        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%; max-width:${EMAIL_CONTENT_MAX_WIDTH}; margin:0 auto;">
                            <tr>
                                <td align="center" style="padding:4px 0; text-align:center; white-space:normal; word-break:keep-all;">
                                    <div style="display:block; max-width:100%; text-align:center; margin:0 auto;">
                                        ${boxes}
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>`;
}


/* Local Utility */
export const htmlDetailTableRows = (details:[string, string][], colspan:number = 1):string => details.map(([label, text]) => 
    `<tr>
        <td colspan="${colspan}" style="font-family:${EMAIL_FONT_FAMILY.DETAIL}; font-size:${EMAIL_FONT_SIZE.DETAIL}; color:${EMAIL_COLOR.GRAY_DARK}; padding:0; line-height:${getEmailLineHeight(EMAIL_FONT_SIZE.DETAIL)};">
            <strong>${label}</strong> ${text}
        </td>
    </tr>`).join('');
