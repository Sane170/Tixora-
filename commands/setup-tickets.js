
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags
} = require("discord.js");

const { loadData, saveData } = require("../utils/dataManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-tickets")
    .setDescription("Set up Tixora's ticket panel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addChannelOption(option =>
      option
        .setName("panel-channel")
        .setDescription("Where should the ticket panel be posted?")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )

    .addRoleOption(option =>
      option
        .setName("staff-role")
        .setDescription("Which role should have access to tickets?")
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({
      flags: MessageFlags.Ephemeral
    });

    const panelChannel = interaction.options.getChannel("panel-channel");
    const staffRole = interaction.options.getRole("staff-role");

    let panelMessage;

    try {
      const botMember = interaction.guild.members.me;

      if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.editReply({
          content: "Tixora needs the Manage Channels permission."
        });
      }

      const permissions = panelChannel.permissionsFor(botMember);

      if (
        !permissions ||
        !permissions.has([
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks
        ])
      ) {
        return interaction.editReply({
          content: "Tixora cannot access or send messages in that channel."
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("Tixora Support Center")
        .setDescription(
          "Need assistance? We're here to help!\n\n" +
          "Select a category below to create a private support ticket.\n\n" +
          "**Available Categories**\n" +
          "• General Support\n" +
          "• Technical Support\n" +
          "• Account Assistance\n" +
          "• Partnerships\n" +
          "• Other Inquiries"
        )
        .setFooter({
          text: "Tixora Support System"
        })
        .setTimestamp();

      const menu = new StringSelectMenuBuilder()
        .setCustomId("tixora_ticket_category")
        .setPlaceholder("Choose a support category...")
        .addOptions(
          {
            label: "General Support",
            description: "General questions and assistance.",
            value: "general"
          },
          {
            label: "Technical Support",
            description: "Report technical problems.",
            value: "technical"
          },
          {
            label: "Account Assistance",
            description: "Get help with account-related issues.",
            value: "account"
          },
          {
            label: "Partnerships",
            description: "Discuss partnership inquiries.",
            value: "partnerships"
          },
          {
            label: "Other Inquiries",
            description: "Anything that doesn't fit elsewhere.",
            value: "other"
          }
        );

      const row = new ActionRowBuilder().addComponents(menu);

      panelMessage = await panelChannel.send({
        embeds: [embed],
        components: [row]
      });

      const configs = await loadData("config");

      configs[interaction.guild.id] = {
        guildId: interaction.guild.id,
        panelChannelId: panelChannel.id,
        panelMessageId: panelMessage.id,
        staffRoleId: staffRole.id,
        setupBy: interaction.user.id,
        setupAt: new Date().toISOString()
      };

      await saveData("config", configs);

      await interaction.editReply({
        content:
          `Your ticket panel has been posted in ${panelChannel}!\n` +
          `Staff role: ${staffRole}\n\n` +
          "Tixora has saved this server's ticket configuration."
      });

    } catch (error) {
      console.error("TICKET SETUP ERROR:", error);

      if (panelMessage) {
        await panelMessage.delete().catch(() => {});
      }

      await interaction.editReply({
        content:
          "Tixora couldn't complete the ticket setup. " +
          "Please check its permissions and try again."
      }).catch(console.error);
    }
  }
};
