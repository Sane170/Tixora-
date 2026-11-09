
const {
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check Tixora's response speed."),

  async execute(interaction, client) {
    try {
      await interaction.deferReply();

      const latency = Date.now() - interaction.createdTimestamp;
      const websocketPing = client.ws.ping;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("Tixora Status")
        .setDescription("Tixora is online and responding!")
        .addFields(
          {
            name: "Bot Latency",
            value: `${latency}ms`,
            inline: true
          },
          {
            name: "WebSocket Latency",
            value: `${websocketPing}ms`,
            inline: true
          },
          {
            name: "Status",
            value: "🟢 Online",
            inline: true
          }
        )
        .setFooter({
          text: "Tixora Support System"
        })
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error("PING COMMAND ERROR:", error);

      const response = {
        content: "Tixora encountered an error while running this command."
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(response).catch(console.error);
      } else {
        await interaction.reply({
          ...response,
          ephemeral: true
        }).catch(console.error);
      }
    }
  }
};
