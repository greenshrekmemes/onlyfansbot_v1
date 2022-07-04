const fs = require('fs');
const { spawn } = require('child_process');
const { WebSocketServer } = require('ws');
const puppeteer = require('puppeteer-extra');
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const MailJS = require('@cemalgnlts/mailjs');
const config = require('./config.json');

const mailjs = new MailJS();

puppeteer.use(StealthPlugin());
puppeteer.use(
    RecaptchaPlugin({
        provider: {
            id: '2captcha',
            token: config[''],
        },
        visualFeedback: true,
    }),
);

const run = (command, args) => new Promise((resolve, reject) => {
    const child = spawn(`${command}.bat`, args, { shell: true });
    let stdout = '';
    child.stdout.on('data', (x) => {
        const message = x.toString();
        console.log(message.trim());
        stdout += `${message}\n`;
    });
    child.stderr.on('data', (x) => {
        const message = x.toString();
        console.log(message.trim());
        stdout += `${message}\n`;
    });
    child.on('exit', (code) => {
        console.log('done', command, code);
        if (code === 0) resolve(stdout);
        else reject(new Error(stdout));
    });
    child.on('error', (err) => reject(err));
});

const subscribeTo = async (model, email, password) => {
    console.log(`Signing into ${email}...`);
    const browser = await puppeteer.launch({
        args: [
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.152 Safari/537.36',
        ],
        headless: false,
        ignoreHTTPSErrors: true,
    });
    const page = await browser.newPage();
    const userAgent = await browser.userAgent();
    await page.setRequestInterception(true);
    let xbc;
    let modelInfo;
    page.on('request', (request) => {
        try {
            if (request.url().startsWith('https://onlyfans.com') && request.headers()['x-bc'] != null) {
                xbc = request.headers()['x-bc'];
                request.continue();
            } else {
                request.continue();
            }
        } catch (e) {

        }
    });
    page.on('response', async (response) => {
        try {
            if (response.url().toLowerCase().startsWith(`https://onlyfans.com/api2/v2/users/${model.toLowerCase().split('\n')[0].split(' ')[0]}`)) {
                modelInfo = await response.json();
            }
        } catch (e) {

        }
    });
    await page.goto('https://onlyfans.com', { waitUntil: 'networkidle0' });
    await page.focus('input[type=email]');
    await page.keyboard.type(email);
    await page.focus('input[type=password]');
    await page.keyboard.type(password);
    const [login] = await page.$x('//button[contains(., \'Login\')]');
    if (!login) {
        await page.screenshot({ path: 'screenshot.png' });
        await browser.close();
        throw Error('Something broke :/');
    }
    await login.click();
    await page.waitForResponse('https://onlyfans.com/api2/v2/users/login');
    await page.waitForTimeout(1000);
    if (await page.$('div#hcap-script')) {
        console.log('Solving captcha...');
        await page.solveRecaptchas();
        await login.click();
        await page.waitForResponse('https://onlyfans.com/api2/v2/users/login');
    }
    const error = await page.$('div[at-attr=error]');
    if (error) {
        const msg = await error.evaluate((el) => el.textContent);
        if (msg.toLowerCase().includes('captcha')) {
            await page.solveRecaptchas();
            await login.click();
            await page.waitForResponse('https://onlyfans.com/api2/v2/users/login');
        } else {
            await page.waitForTimeout(1000);
            await browser.close();
            throw new Error(msg);
        }
    }
    console.log('Logged in!');
    await page.goto(`https://onlyfans.com/${model}`, { waitUntil: 'networkidle0' });
    const [popup] = await page.$x('//*[@id="ModalUserAlert___BV_modal_footer_"]/button');
    const [popup2] = await page.$x('//*[@id="ModalUserAlert___BV_modal_header_"]/button');
    if (popup) await popup.click();
    if (popup2) await popup2.click();
    await page.waitForTimeout(1000);

    const [subscribeNow] = await page.$x('//div[@role=\'button\' and descendant::span[contains(., \'subscribe\')]]');
    const [alreadySubscribed] = await page.$x('//div[@role=\'button\' and descendant::span[contains(., \'subscribed\')]]');

    if (alreadySubscribed) {
        console.log('Already subscribed!');
    } else if (subscribeNow) {
        await subscribeNow.click();
        console.log('clicked subscribe');
        await page.waitForTimeout(10000);
        console.log('checked for subscribe');
        const [nowSubscribed] = await page.$x('//div[@role=\'button\' and descendant::span[contains(., \'subscribed\')]]');
        if (nowSubscribed) {
            console.log('Now Subscribed!');
        } else {
            const [btn1] = await page.$x('//*[@id="ModalSubscribe___BV_modal_body_"]/div/div/div/div/div[3]/div[2]/button');
            if (btn1) {
                await btn1.click();
                await page.waitForTimeout(10000);
                const [nowSubscribed2] = await page.$x('//div[@role=\'button\' and descendant::span[contains(., \'subscribed\')]]');
                if (nowSubscribed2) {
                    console.log('Now Subscribed!');
                } else {
                    const [btn2] = await page.$x('//*[@id="ModalAlert___BV_modal_footer_"]/button[2]');
                    if (btn2) {
                        await btn2.click();
                        await page.waitForTimeout(10000);
                        const [nowSubscribed3] = await page.$x('//div[@role=\'button\' and descendant::span[contains(., \'subscribed\')]]');
                        if (nowSubscribed3) {
                            console.log('Now Subscribed!');
                        } else {
                            await page.screenshot({ path: 'screenshot.png' });
                            await browser.close();
                            throw Error('Purchase failed');
                        }
                    } else {
                        await page.screenshot({ path: 'screenshot.png' });
                        await browser.close();
                        throw Error('Purchase failed');
                    }
                }
            } else {
                await page.screenshot({ path: 'screenshot.png' });
                await browser.close();
                throw Error('I cant find the purchase button! (3)');
            }
        }
    } else {
        await page.screenshot({ path: 'screenshot.png' });
        const [doesntExist] = await page.$x('//*[contains(text(), "this page is not available")]');
        await browser.close();
        if (doesntExist) throw Error('That model doesn\'t exist!');
        else throw Error('I cant find the purchase button!');
    }
    const cookies = await page.cookies();
    await browser.close();
    return {
        cookies: cookies.map(({ name, value }) => `${name}=${value}`).join('; '), userAgent, xbc, modelInfo,
    };
};

const downloadData = (username, cookies, xbc) => new Promise((resolve, reject) => {
    fs.rmSync('../scraper/.sites/OnlyFans', { recursive: true, force: true });
    const child = spawn('python', ['../scraper/start_ofd.py', username, cookies, xbc]);
    let finished;
    const messages = [];
    child.stdout.on('data', (x) => {
        const message = x.toString();
        console.log(message);
        messages.push(message);
        if (message.includes('Scrape Completed')) finished = true;
    });
    child.stderr.on('data', (x) => {
        const message = x.toString();
        console.log(message);
    });
    child.on('close', () => (finished ? resolve() : reject(messages)));
    child.on('error', (err) => reject(err));
});

const getMegaAccount = async () => {
    await run('mega-logout');
    const { data: { username } } = await mailjs.createOneAccount();
    await run('mega-signup', [username, 'Pass123']);
    const getConfirmationLink = new Promise((resolve, reject) => {
        const interval = setInterval(async () => {
            try {
                const { data: emails } = await mailjs.getMessages();
                if (emails.length > 0 && emails[0].from.address === 'welcome@mega.nz') {
                    clearInterval(interval);
                    const { data: { text } } = await mailjs.getMessage(emails[0].id);
                    const link = text.match(/https:\/\/.+/)[0];
                    resolve(link);
                }
            } catch (e) {
                reject(e);
            }
        }, 1000);

        setTimeout(async () => {
            if (interval) {
                clearInterval(interval);
                reject(new Error('email verification time limit ran out'));
            }
        }, 30 * 1000);
    });
    await run('mega-confirm', [await getConfirmationLink, username, 'Pass123']);
    await run('mega-login', [username, 'Pass123']);
    await run('mega-whoami');
};

const wss = new WebSocketServer({ port: 15232 });

wss.on('connection', (ws) => {
    ws.on('message', async (msg) => {
        const { type, data } = JSON.parse(msg.toString());
        if (type === 'start') {
            try {
                await ws.send(JSON.stringify({
                    type: 'update',
                    data: {
                        embeds: [{
                            author: {
                                name: `Subscribing to ${data.model}... This will take a while...`,
                                iconURL: 'https://cdn.discordapp.com/emojis/636549313492680706.gif',
                            },
                            color: config.embedColor,
                            footer: {
                                text: `Connected to Server #${data.serverId}/${data.liveServers}`,
                            },
                        }],
                    },
                }));
                const { email, password } = data.account;
                const { cookies, xbc } = await subscribeTo(data.model, email, password);
                await ws.send(JSON.stringify({
                    type: 'update',
                    data: {
                        embeds: [{
                            author: {
                                name: `Downloading content from ${data.model}... This will take a while...`,
                                iconURL: 'https://cdn.discordapp.com/emojis/636549313492680706.gif',
                            },
                            color: config.embedColor,
                            footer: {
                                text: `Connected to Server #${data.serverId}/${data.liveServers}`,
                            },
                        }],
                    },
                }));
                await downloadData(data.model, cookies, xbc);
                await ws.send(JSON.stringify({
                    type: 'update',
                    data: {
                        embeds: [{
                            author: {
                                name: `Uploading content from ${data.model} to MEGA... This will take a while...`,
                                iconURL: 'https://cdn.discordapp.com/emojis/636549313492680706.gif',
                            },
                            color: config.embedColor,
                            footer: {
                                text: `Connected to Server #${data.serverId}/${data.liveServers}`,
                            },
                        }],
                    },
                }));
                await getMegaAccount();
                const folderName = `"${data.model} ${(new Date()).toUTCString()}"`;
                await run('mega-put', [`../scraper/.sites/OnlyFans/${data.model}`, folderName]);
                const result = await run('mega-export', ['-a', folderName]);
                const link = result.match(/https:\/\/mega.nz\/folder\/.+/)[0];
                await ws.send(JSON.stringify({ type: 'finished', data: link }));
            } catch (e) {
                console.log('Failed: ', e);
                await ws.send(JSON.stringify({ type: 'fail', data: e?.message }));
            }
        } else {
            console.log(`Unknown type: ${type}`);
        }
    });
});

const test = async (model, email, password) => {
    const { cookies, xbc } = await subscribeTo(model, email, password);
    await downloadData(model, cookies, xbc);
    await getMegaAccount();
    const folderName = `"${model} ${(new Date()).toUTCString()}"`;
    await run('mega-put', [`../scraper/.sites/OnlyFans/${model}`, folderName]);
    const result = await run('mega-export', ['-a', folderName]);
    const link = result.match(/https:\/\/mega.nz\/folder\/.+/)[0];
    console.log(link);
};
// test('kreaykiwi', 'nickkijek91@gmail.com', 'Breezy25');
