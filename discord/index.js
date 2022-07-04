const { Client, Intents } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const cc = require('cryptocompare');
const bjs = require('bitcoinjs-lib');
const bip32 = require('@asoltys/bip32');
const bchaddr = require('bchaddrjs');
const coininfo = require('coininfo');
const fetch = require('node-fetch');
const config = require('./config.json');

global.fetch = fetch;

cc.setApiKey(config.cryptoCompareApiKey);
const client = new Client({
    intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_INTEGRATIONS],
    presence: {
        status: 'online',
        activities: [{ name: `${config.prefix}help - Call me Pete the way I steal these bitches`, type: 'PLAYING' }],
    },
});

const commands = Object.fromEntries(fs.readdirSync(path.join(__dirname, 'commands')).map((file) => {
    const name = file.split('.').slice(0, -1).join('.');
    return [name, require(`./commands/${file}`)];
}));

const mongo = new MongoClient(config.mongoUri);
mongo.connect().then(async () => {
    const database = mongo.db('onlyfans');
    const users = database.collection('users');
    const channels = database.collection('channels');
    const transactions = database.collection('transactions');
    const settings = database.collection('settings');

    client.on('ready', () => console.log(`logged in as ${client.user.id}`));
    client.on('messageCreate', async (msg) => {
        await channels.updateOne({ id: msg.channel.id }, {
            $set: { expiration: new Date((new Date()).getTime() + (12 * 60 * 60 * 1000)) },
        });
        if (!msg.author.bot && msg.content.startsWith(config.prefix)) {
            const removedPrefix = msg.content.replace(new RegExp(`${config.prefix} ?`), '');
            const [command, ...args] = removedPrefix.split(' ');
            if (commands[command]) {
                await users.updateOne({ id: msg.author.id }, {
                    $setOnInsert: {
                        id: msg.author.id,
                        credits: {},
                    },
                }, { upsert: true });
                await commands[command].func(msg, args, client, config, database);
            }
        }
    });
    client.on('interactionCreate', async (interaction) => {
        if (interaction.componentType === 'BUTTON') {
            if (interaction.customId === 'cashapp') {
                try {
                    await interaction.user.send({
                        embeds: [{
                            title: 'One-Time Credit Purchase',
                            fields: [{
                                name: 'Price',
                                value: 'Unavailable',
                            },
                            {
                                name: 'Cashtag',
                                value: 'Unavailable',
                            },
                            {
                                name: 'Note',
                                value: 'Paying with Cash App is temporarily disabled. Please try again later or pay a different way.',
                            }],
                            color: config.embedColor,
                        }],
                    });
                    await interaction.reply({
                        ephemeral: true,
                        embeds: [{
                            title: 'One-Time Credit Purchase',
                            description: 'The payment details have been sent to your DM',
                            color: config.embedColor,
                        }],
                    });
                } catch (e) {
                    await interaction.reply({
                        ephemeral: true,
                        embeds: [{
                            description: 'Please open your DMs and try again.',
                            color: config.embedColor,
                        }],
                    });
                }
            } else if (['btc', 'bch', 'ltc', 'doge'].includes(interaction.customId)) {
                if (await transactions.findOne({ paymentType: interaction.customId, user: interaction.user.id, expiration: { $gt: new Date() } })) {
                    await interaction.reply({
                        ephemeral: true,
                        embeds: [{
                            description: `You have an uncompleted ${interaction.customId.toUpperCase()} payment open!`,
                            color: config.embedColor,
                        }],
                    });
                } else {
                    const type = interaction.customId;
                    const networks = {
                        btc: 'bitcoin',
                        bch: 'bitcoincash',
                        ltc: 'litecoin',
                        doge: 'dogecoin',
                    };
                    const result = await settings.findOneAndUpdate({ type: 'addressIndex' }, { $inc: { [type]: 1 } }, { returnDocument: 'after' });
                    const addressIndex = result.value[type];
                    const network = coininfo[networks[type]].main.toBitcoinJS();
                    let address = bjs.payments[['btc', 'ltc'].includes(type) ? 'p2wpkh' : 'p2pkh']({
                        pubkey: bip32.fromBase58(config.pubkeys[type], network).derive(0).derive(addressIndex).publicKey,
                        network,
                    });
                    if (type === 'bch') address = bchaddr.toCashAddress(address.address).replace('bitcoincash:', '');
                    else address = address.address;

                    const cryptoTicker = type.toUpperCase();
                    const { USD: cryptoPrice } = await cc.price(cryptoTicker, 'USD');
                    const usdToCrypto = (usd) => parseFloat(((1 / cryptoPrice) * usd).toPrecision(5));
                    try {
                        const threshold = (usdToCrypto(config.price) * 10).toPrecision(5);
                        await interaction.user.send({
                            embeds: [{
                                title: 'One-Time Credit Purchase',
                                fields: [{
                                    name: 'Price',
                                    value: `${usdToCrypto(config.price)} ${cryptoTicker}/credit`,
                                },
                                {
                                    name: `Bulk Price (more than ${threshold} ${cryptoTicker})`,
                                    value: `${usdToCrypto(config.bulkPrice)} ${cryptoTicker}/credit`,
                                },
                                {
                                    name: 'Address',
                                    value: `\`${address}\``,
                                }],
                                image: {
                                    url: `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${networks[type]}:${address}`,
                                },
                                thumbnail: {
                                    url: `https://cryptoicon-api.vercel.app/api/icon/${cryptoTicker.toLowerCase()}`,
                                },
                                footer: {
                                    text: 'You have 12 hours to send money before the transaction expires.',
                                },
                                description: `**This transaction is for sending ${cryptoTicker}. Send as much as needed for the amount of credits you want.**`,
                                color: config.embedColor,
                            }],
                        });
                        await transactions.insertOne({
                            active: true,
                            address,
                            expiration: new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)),
                            user: interaction.user.id,
                            guild: interaction.guild.id,
                            paymentType: type,
                            rate: cryptoPrice,
                            balance: 0,
                            unconfirmed: 0,
                            threshold: parseFloat(threshold),
                        });
                        await interaction.reply({
                            ephemeral: true,
                            embeds: [{
                                title: 'One-Time Credit Purchase',
                                description: 'The payment details have been sent to your DM',
                                color: config.embedColor,
                            }],
                        });
                    } catch (e) {
                        await interaction.reply({
                            ephemeral: true,
                            embeds: [{
                                description: 'Please open your DMs and try again.',
                                color: config.embedColor,
                            }],
                        });
                    }
                }
            }
        }
    });
    await client.login(config.token);

    const checkPayments = async () => {
        // noinspection ES6MissingAwait
        await transactions.find({ expiration: { $gt: new Date() }, active: true }).forEach(async (tx) => {
            try {
                let addressInfo;
                if (tx.paymentType === 'bch') {
                    const result = await fetch(`https://rest.bitcoin.com/v2/address/details/${tx.address}`);
                    const json = await result.json();
                    if (json.error) addressInfo = { ...json, status: 'fail' };
                    else {
                        addressInfo = {
                            status: 'success',
                            data: {
                                confirmed_balance: json.balance,
                                unconfirmed_balance: json.unconfirmedBalance,
                            },
                        };
                    }
                } else {
                    const result = await fetch(`https://chain.so/api/v2/get_address_balance/${tx.paymentType}/${tx.address}`);
                    addressInfo = await result.json();
                }
                if (addressInfo.status === 'success') {
                    const { confirmed_balance: balance, unconfirmed_balance: unconfirmed } = addressInfo.data;
                    const user = await client.users.fetch(tx.user);
                    if (unconfirmed > tx.unconfirmed) {
                        await transactions.updateOne(tx, { $set: { unconfirmed } });
                        await user.send({
                            embeds: [{
                                title: `${tx.paymentType.toUpperCase()} Transaction Waiting For Confirmation`,
                                description: `Your ${unconfirmed - tx.unconfirmed} ${tx.paymentType.toUpperCase()} transaction has been received and is now waiting for confirmation.`,
                                color: config.embedColor,
                                thumbnail: {
                                    url: `https://cryptoicon-api.vercel.app/api/icon/${tx.paymentType}`,
                                },
                            }],
                        });
                    }
                    if (balance > tx.balance) {
                        await transactions.updateOne(tx, { $set: { balance } });
                        const usd = balance * tx.rate;
                        const credits = Math.round(balance > tx.threshold ? usd / config.bulkPrice : usd / config.price);
                        await users.updateOne({ id: tx.user }, { $inc: { [`credits.${tx.guild}`]: credits } });
                        await user.send({
                            embeds: [{
                                title: `Successful ${tx.paymentType.toUpperCase()} Transaction`,
                                description: `Your ${balance - tx.balance} ${tx.paymentType.toUpperCase()} transaction has been received and ${credits} credit(s) have been added to your account.`,
                                color: config.embedColor,
                                thumbnail: {
                                    url: `https://cryptoicon-api.vercel.app/api/icon/${tx.paymentType}`,
                                },
                            }],
                        });
                    }
                } else {
                    console.error(addressInfo);
                }
            } catch (e) {
                console.error(e);
                await transactions.updateOne(tx, { $set: { active: false } });
            }
        });
    };
    const checkPrivateChannels = async () => {
        // noinspection ES6MissingAwait
        await channels.find({ expiration: { $lt: new Date() } }).forEach(async (channel) => {
            const dsChannel = await client.channels.fetch(channel.id);
            await dsChannel.delete();
            await channels.deleteOne(channel);
        });
    };
    setInterval(checkPrivateChannels, 60000);
    setInterval(checkPayments, 60000);
});
