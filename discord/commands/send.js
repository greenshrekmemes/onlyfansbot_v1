module.exports = {
    name: 'Send',
    helpSmall: 'Send your credits to someone else',
    example: '%prefix%send @user amount',
    func: async (msg, args, client, config, database) => {
        const recipient = msg.mentions.users.first();
        const amount = parseInt(args[1], 10);
        if (recipient && amount && amount > 0) {
            if (recipient.id !== msg.author.id) {
                const users = database.collection('users');
                const user = await users.findOne({ id: msg.author.id });
                if (user.credits[msg.guild.id] >= amount) {
                    const recipientData = await users.findOne({ id: recipient.id });
                    if (recipientData) {
                        await users.updateOne({ id: msg.author.id }, { $inc: { [`credits.${msg.guild.id}`]: -amount } });
                        await users.updateOne({ id: recipient.id }, { $inc: { [`credits.${msg.guild.id}`]: amount } });
                        await msg.reply({
                            embeds: [{
                                description: 'Credits sent!',
                                color: config.embedColor,
                            }],
                        });
                    } else {
                        await msg.reply({
                            embeds: [{
                                description: 'That user has not used the bot before. Make sure they use it first (which means run at least one command).',
                                color: config.embedColor,
                            }],
                        });
                    }
                } else {
                    await msg.reply({
                        embeds: [{
                            description: 'You don\'t have enough credits to send that amount!',
                            color: config.embedColor,
                        }],
                    });
                }
            } else {
                await msg.reply({
                    embeds: [{
                        description: 'That is how you get your credits sent into the void.',
                        color: config.embedColor,
                    }],
                });
            }
        } else {
            await msg.reply({
                embeds: [{
                    description: `The format for sending credits is \`${config.prefix}send @user amount\``,
                    color: config.embedColor,
                }],
            });
        }
    },
};
