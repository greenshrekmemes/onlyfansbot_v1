const { MessageActionRow, MessageButton } = require('discord.js');

module.exports = {
    name: 'Buy',
    helpSmall: 'Buy some credits',
    example: '%prefix%buy',
    func: async (msg, args, client, config) => {
        const row = new MessageActionRow()
            .addComponents(
                new MessageButton().setCustomId('cashapp').setLabel('Cashapp (US & UK)').setStyle('SECONDARY'),
                new MessageButton().setCustomId('btc').setLabel('Bitcoin').setStyle('SECONDARY'),
                new MessageButton().setCustomId('bch').setLabel('Bitcoin Cash').setStyle('SECONDARY'),
                new MessageButton().setCustomId('ltc').setLabel('Litecoin').setStyle('SECONDARY'),
                new MessageButton().setCustomId('doge').setLabel('Dogecoin').setStyle('SECONDARY'),
            );

        await msg.reply({ content: 'How would you like to pay for credits?', components: [row] });
    },
};
