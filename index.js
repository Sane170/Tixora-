
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check Tixora's response speed."),

  async execute(interaction, client) {
    try {
      await interaction.deferReply();

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("Tixora Status")
        .setDescription("Tixora is online and responding!")
        .addFields(
          {
            name: "WebSocket Latency",
            value: `${client.ws.ping}ms`,
            inline: true
          },
          {
            name: "Status",
            value: "Online",
            inline: true
          }
        )
        .setFooter({ text: "Tixora Support System" })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error("PING COMMAND ERROR:", error);

      if (interaction.deferred) {
        await interaction.editReply({
          content: "Tixora encountered an error while running this command."
        }).catch(console.error);
      }
    }
  }
};
