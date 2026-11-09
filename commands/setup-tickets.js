
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits
} = require("discord.js");

const fs = require("node:fs");
const path = require("node:path");

const dataFolder = path.join(__dirname, "../data");
const configPath = path.join(dataFolder, "ticket-config.json");

function loadConfigs() {
  if (!fs.existsSync(configPath)) {
    return {};
  }

  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function saveConfigs(configs) {
  fs.mkdirSync(dataFolder, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(configs, null, 2));
}

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
    const panelChannel = interaction.options.getChannel("panel-channel");
    const staffRole = interaction.options.getRole("staff-role");

    const botMember = interaction.guild.members.me;

    if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: "Tixora needs the Manage Channels permission to create tickets.",
        ephemeral: true
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
      .setFooter({ text: "Tixora Support System" })
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

    try {
      await panelChannel.send({
        embeds: [embed],
        components: [row]
      });

      const configs = loadConfigs();

      configs[interaction.guild.id] = {
        panelChannelId: panelChannel.id,
        staffRoleId: staffRole.id
      };

      saveConfigs(configs);

      await interaction.reply({
        content: `Your ticket panel has been posted in ${panelChannel}!\nStaff role: ${staffRole}`,
        ephemeral: true
      });

    } catch (error) {
      console.error("TICKET SETUP ERROR:", error);

      await interaction.reply({
        content: "Tixora couldn't set up the ticket panel. Check its channel permissions.",
        ephemeral: true
      }).catch(console.error);
    }
  }
};
