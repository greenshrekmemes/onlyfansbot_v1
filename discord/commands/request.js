const WebSocket = require('ws');
const config = require('../config.json');

const queue = [];
let liveServers = 0;
config.servers.forEach((uri, index) => {
    const ws = new WebSocket(uri);
    let available = false;
    let statusMsg;
    let userId;
    let guildId;
    let accountEmail;
    let db;
    ws.on('open', async () => {
        console.log(`Server #${index + 1} Connected!`);
        available = true;
        liveServers += 1;
        const interval = setInterval(async () => {
            if (ws.readyState === 1) {
                if (available && queue.length > 0) {
                    console.log(`Server #${index + 1} Started!`);
                    const {
                        status, model, account, user, guild, database,
                    } = queue.shift();
                    statusMsg = status;
                    db = database;
                    accountEmail = account.email;
                    userId = user.id;
                    guildId = guild.id;
                    await ws.send(JSON.stringify({
                        type: 'start',
                        data: {
                            model, account, serverId: index + 1, liveServers,
                        },
                    }));
                    available = false;
                }
            } else {
                ws.close();
                clearInterval(interval);
                if (statusMsg) {
                    await db.collection('users').updateOne({ id: userId }, { $inc: { [`credits.${guildId}`]: 1 } });
                    await statusMsg.edit({
                        embeds: [{
                            author: {
                                name: 'Looks like something went wrong ;-;',
                                iconURL: 'https://cdn.discordapp.com/attachments/348576300287655937/745856294518521948/721223605907619881.png',
                            },
                            color: config.embedColor,
                            footer: {
                                text: `Connected to Server #${index + 1}/${liveServers}`,
                            },
                        }],
                    });
                }
                liveServers -= 1;
                console.log(`Server #${index + 1} Closed.`);
            }
        }, 10000);
    });
    ws.on('message', async (msg) => {
        const { type, data } = JSON.parse(msg.toString());
        if (type === 'update') {
            await statusMsg.edit(data);
        } else if (type === 'fail') {
            console.log(data);
            available = true;
            if (!data.includes('That model doesn\'t exist')) {
                await db.collection('accounts').updateOne({ email: accountEmail }, { $set: { dead: data } });
            }
            await db.collection('users').updateOne({ id: userId }, { $inc: { [`credits.${guildId}`]: 1 } });
            await statusMsg.edit({
                embeds: [{
                    author: {
                        name: 'Looks like something went wrong ;-;',
                        iconURL: 'https://cdn.discordapp.com/attachments/348576300287655937/745856294518521948/721223605907619881.png',
                    },
                    color: config.embedColor,
                    footer: {
                        text: `Connected to Server #${index + 1}/${liveServers}`,
                    },
                }],
            });
        } else if (type === 'finished') {
            await statusMsg.edit({
                embeds: [{
                    description: `Successfully downloaded content! Here's your link: ${data}`,
                    color: config.embedColor,
                    footer: {
                        text: `Connected to Server #${index + 1}/${liveServers}`,
                    },
                }],
            });
            available = true;
        } else {
            console.log(`Unknown type: ${type}`);
        }
    });
    ws.on('error', () => ws.close());
    return ws;
});

module.exports = {
    name: 'Request',
    helpSmall: 'Request your favorite creator (1 credit)',
    example: '%prefix%request <username>',
    func: async (msg, args, client, config, database) => {
        if (args[0]) {
            const users = database.collection('users');
            const user = await users.findOne({ id: msg.author.id });
            if (user.credits[msg.guild.id] >= 1) {
                const accounts = await database.collection('accounts').find({ dead: false }).toArray();
                if (liveServers > 0 && accounts.length > 0) {
                    await users.updateOne(user, { $inc: { [`credits.${msg.guild.id}`]: -1 } });
                    try {
                        const status = await msg.author.send({
                            embeds: [{
                                author: {
                                    name: 'Requesting an Available Server, Please wait...',
                                    iconURL: 'https://i.imgur.com/8dtQih5.gif',
                                },
                                color: config.embedColor,
                            }],
                        });
                        queue.push({
                            status,
                            model: args[0],
                            account: accounts[Math.floor(Math.random() * accounts.length)],
                            user: msg.author,
                            guild: msg.guild,
                            database,
                        });
                    } catch (e) {
                        await msg.reply({
                            embeds: [{
                                description: 'Please open your DMs and try again.',
                                color: config.embedColor,
                            }],
                        });
                    }
                } else {
                    await msg.reply({
                        embeds: [{
                            author: {
                                name: 'The bot is currently in maintenance mode. Please try again in a little bit.',
                            },
                            color: config.embedColor,
                        }],
                    });
                }
            } else {
                await msg.reply({
                    embeds: [{
                        description: `Looks like you're out of credits! You need 1 credit to make a request. You can get more credits by saying \`${config.prefix}buy\``,
                        color: config.embedColor,
                    }],
                });
            }
        } else {
            await msg.reply({
                embeds: [{
                    description: 'Please specify who you want to request.',
                    color: config.embedColor,
                }],
            });
        }
    },
};
