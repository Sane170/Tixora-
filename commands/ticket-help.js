const {
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-help")
    .setDescription("Learn how to use Tixora's ticket system."),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("Tixora Help Center")
      .setDescription(
        "Welcome to Tixora! Here's how to get support."
      )
      .addFields(
        {
          name: "Creating a Ticket",
          value:
            "1. Find the ticket panel.\n" +
            "2. Select a support category.\n" +
            "3. Wait for a private ticket channel to be created."
        },
        {
          name: "Inside Your Ticket",
          value:
            "• Explain your issue clearly.\n" +
            "• Provide any helpful information.\n" +
            "• Wait for a staff member to respond.\n" +
            "• Use the close button when you're finished."
        },
        {
          name: "Ticket Commands",
          value:
            "`/ticket-feedback` — Rate your support experience.\n" +
            "`/ticket-help` — View this help guide."
        },
        {
          name: "Need More Help?",
          value:
            "Contact a server staff member if you have trouble using the ticket system."
        }
      )
      .setFooter({ text: "Tixora Support System" })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
};
