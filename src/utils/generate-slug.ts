// slug.utils.ts

const translit = (str: string): string => {
    const ru = 'А-а-Б-б-В-в-Г-г-Д-д-Е-е-Ё-ё-Ж-ж-З-з-И-и-Й-й-К-к-Л-л-М-м-Н-н-О-о-П-п-Р-р-С-с-Т-т-У-у-Ф-ф-Х-х-Ц-ц-Ч-ч-Ш-ш-Щ-щ-Ъ-ъ-Ы-ы-Ь-ь-Э-э-Ю-ю-Я-я'.split('-');
    
    const en = "A-a-B-b-V-v-G-g-D-d-E-e-E-e-E-e-Zh-zh-Z-z-I-i-I-i-I-i-J-j-K-k-L-l-M-m-N-n-O-o-P-p-R-r-S-s-T-t-U-u-F-f-H-h-Ts-ts-CH-ch-SH-sh-SCH-sch-'-'Y-y-'-'E-e-YU-yu-YA-ya".split('-');
    
    let res = '';
    
    for (let i = 0, l = str.length; i < l; i++) {
        const s = str.charAt(i);
        const n = ru.indexOf(s);
        
        if (n >= 0) {
            res += en[n];
        } else {
            res += s;
        }
    }
    
    return res;
};

export const generateSlug = (str: string): string => {
    if (!str) return '';
    
    let url = str.toLowerCase();
    url = translit(url);
    
    // Замена пробелов и специальных символов на дефисы
    url = url.replace(/[^\w\s-]/g, '');  // Удаляем спецсимволы
    url = url.replace(/\s+/g, '-');       // Заменяем пробелы на дефисы
    url = url.replace(/--+/g, '-');       // Убираем повторяющиеся дефисы
    url = url.replace(/^-+|-+$/g, '');    // Убираем дефисы в начале и конце
    
    return url;
};