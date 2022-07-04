module.exports = {
    name: 'Private',
    helpSmall: 'Create a private channel to run commands in',
    example: '%prefix%private',
    func: async (msg, args, client, config, database) => {
        const channels = database.collection('channels');
        if (!(await channels.findOne({ userId: msg.author.id }))) {
            const newChannel = await msg.guild.channels.create(msg.author.username, {
                parent: config.privateChannelCategory,
                permissionOverwrites: [{
                    id: msg.author.id, allow: ['SEND_MESSAGES', 'VIEW_CHANNEL'],
                }, {
                    id: msg.guild.id, deny: ['VIEW_CHANNEL'],
                }],
            });
            await msg.delete();
            await channels.insertOne({
                id: newChannel.id,
                userId: msg.author.id,
                expiration: new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)),
            });
            await newChannel.send(`<@${msg.author.id}> Your private channel has been created! Only you, the bot and the owner can access this channel.\nThis channel will be deleted after 24 hours of inactivity.`);
        } else {
            await msg.reply({
                embeds: [{
                    description: 'You already have a private channel open!',
                    color: config.embedColor,
                }],
            });
        }
    },
};
