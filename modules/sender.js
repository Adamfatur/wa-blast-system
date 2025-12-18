const { log } = require('./logger');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function sendMessageWithDelay(client, number, message, minDelay = 2000, maxDelay = 5000) {
    try {
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
        log(`Waiting ${delay}ms before sending to ${number}...`);
        await sleep(delay);

        await client.sendMessage(number, message);
        log(`Message sent to ${number}`, 'SUCCESS');
        return true;
    } catch (error) {
        log(`Failed to send to ${number}: ${error.message}`, 'ERROR');
        return false;
    }
}

module.exports = { sendMessageWithDelay };
