module.exports = {
    name: 'Credits',
    helpSmall: 'View your balance',
    example: '%prefix%credits',
    func: async (msg, args, client, config, database) => {
        const user = await database.collection('users').findOne({ id: msg.author.id });
        const credits = user.credits[msg.guild.id] || 0;
        await msg.reply({
            embeds: [{
                description: `You have ${credits} credit${credits === 1 ? '' : 's'}!`,
                color: config.embedColor,
            }],
        });
    },
};
