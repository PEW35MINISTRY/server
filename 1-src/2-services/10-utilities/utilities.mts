


/*********************
 * GENERIC UTILITIES *
 *********************/

export const camelCase = (...terms:string[]) => terms.filter(term => term !== undefined && term !== '')
    .map((term:string) => { 
        let newTerm = term.replace(/\s+/g, ''); 
        return newTerm.charAt(0).toUpperCase() + newTerm.slice(1);
    })
    .join('')
    .replace(/^\w/, firstCharacter => firstCharacter.toLowerCase());
