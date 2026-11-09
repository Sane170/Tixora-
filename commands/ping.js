
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check Tixora's response speed."),

  async execute(interaction, client) {
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

    await interaction.reply({ embeds: [embed] });
  }
};
