export class FileMimeType {
    private readonly value: string;

    private static normalizationMap = new Map([
        ['jpeg', 'image/jpeg'],
        ['jpg', 'image/jpeg'],
        ['image', 'image/jpeg'],
        ['txt', 'text/plain'],
        ['text', 'text/plain'],
        ['html', 'text/html'],
        ['json', 'application/json'],
        ['pdf', 'application/pdf'],
        ['csv', 'text/csv'],
        ['xml', 'application/xml'],
        ['zip', 'application/zip'],
        ['javascript', 'application/javascript'],
        ['js', 'application/javascript'],
        ['css', 'text/css'],
        ['doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        ['xls', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        ['ppt', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
        ['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
        ['googledocs', 'application/vnd.google-apps.document'],
        ['gdoc', 'application/vnd.google-apps.document'],
        ['googlesheets', 'application/vnd.google-apps.spreadsheet'],
        ['gsheet', 'application/vnd.google-apps.spreadsheet'],
        ['googleslides', 'application/vnd.google-apps.presentation'],
        ['gslide', 'application/vnd.google-apps.presentation']
    ]);

    private constructor(mimeType: string) {
        this.value = mimeType;
    }

    static create(rawMimeType: string) {
        if (typeof rawMimeType !== 'string' || rawMimeType.trim() === '') {
            Logger.log('Error: MIMEタイプは空でない文字列である必要があります。');
            return null;
        }

        const normalizedMimeType = FileMimeType.normalize(rawMimeType.trim().toLowerCase());

        if (!FileMimeType.isValid(normalizedMimeType)) {
            Logger.log(`Error: 不正なMIMEタイプが指定されました: "${rawMimeType}" (正規化後: "${normalizedMimeType}")`);
            return null;
        }

        return new FileMimeType(normalizedMimeType);
    }

    private static normalize(mimeType: string) {
        return FileMimeType.normalizationMap.get(mimeType) || mimeType;
    }

    private static isValid(mimeType: string) {
        const mimeTypePattern = /^[a-zA-Z0-9\-\.]+\/[a-zA-Z0-9\-\.\+]+$/;
        if (mimeTypePattern.test(mimeType)) {
            return true;
        }

        const googleMimeTypes = [
            'application/vnd.google-apps.document',
            'application/vnd.google-apps.spreadsheet',
            'application/vnd.google-apps.presentation',
            'application/vnd.google-apps.drawing',
            'application/vnd.google-apps.script',
            'application/vnd.google-apps.folder',
            'application/vnd.google-apps.form',
            'application/vnd.google-apps.site',
            'application/vnd.google-apps.map',
            'application/vnd.google-apps.fusiontable',
            'application/vnd.google-apps.script-json',
            'application/vnd.google-apps.shortcut'
        ];
        if (googleMimeTypes.includes(mimeType)) {
            return true;
        }

        const commonMimeTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp',
            'text/plain', 'text/html', 'text/css', 'text/csv',
            'application/json', 'application/pdf', 'application/xml', 'application/zip',
            'application/javascript',
            'audio/mpeg', 'audio/wav',
            'video/mp4', 'video/webm'
        ];
        if (commonMimeTypes.includes(mimeType)) {
            return true;
        }

        return false;
    }

    toString() {
        return this.value;
    }

    getValue() {
        return this.value;
    }
}