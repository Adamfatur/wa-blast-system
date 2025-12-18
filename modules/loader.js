const fs = require('fs');

function loadContacts(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        const data = fs.readFileSync(filePath, 'utf8');
        const contacts = JSON.parse(data);

        if (!Array.isArray(contacts)) {
            throw new Error("Invalid format: Root must be an array");
        }

        return contacts.map(c => {
            let number = c.number.replace(/\D/g, ''); // Remove non-digits
            if (number.startsWith('0')) {
                number = '62' + number.slice(1);
            }
            if (!number.endsWith('@c.us')) {
                number += '@c.us';
            }
            return { ...c, formattedNumber: number };
        });

    } catch (error) {
        throw new Error(`Failed to load contacts: ${error.message}`);
    }
}

module.exports = { loadContacts };
