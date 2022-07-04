const fs = require('fs');

module.exports = {
    name: 'Help',
    helpSmall: 'Find out the commands.',
    example: '%prefix%help\n\n%prefix%help <command>',
    func: async (msg, args, client, { prefix }) => {
        const cmds = Object.fromEntries(fs.readdirSync(__dirname).map((file) => {
            const name = file.split('.').slice(0, -1).join('.');
            return [name, require(`./${file}`)];
        }));
        let title = '';
        let description = '';
        if (args[0]) {
            if (cmds[args[0].toLowerCase()]) {
                let cmdHelp = '';
                let cmdHelpSmall = '';
                let cmdExample = '';
                if (cmds[args[0].toLowerCase()].help) {
                    cmdHelp = cmds[args[0].toLowerCase()].help;
                }
                if (cmds[args[0].toLowerCase()].helpSmall) {
                    cmdHelpSmall = cmds[args[0].toLowerCase()].helpSmall;
                }
                if (cmds[args[0].toLowerCase()].example) {
                    cmdExample = cmds[args[0].toLowerCase()].example.replace(/%prefix%/g, prefix);
                }
                title = cmds[args[0].toLowerCase()].name;
                description = `**${cmdHelpSmall}**\n\n${cmdHelp}\n\n*ex:* ${cmdExample}\n \n`;
            }
        } else {
            title = 'Commands';
            description = Object.keys(cmds).reduce((prev, cmd) => {
                if (cmds[cmd].name) {
                    if (cmds[cmd].helpSmall) {
                        return `${prev}**${prefix}${cmds[cmd].name.toLowerCase()}** *-* ${cmds[cmd].helpSmall}\n \n`;
                    }
                    return `${prev}**${prefix}${cmds[cmd].name.toLowerCase()}**\n \n`;
                } return prev;
            }, '');
        }
        await msg.reply({
            embeds: [{
                title,
                description,
            }],
        });
    },
};
