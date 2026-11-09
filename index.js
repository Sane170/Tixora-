
const {
  Client,
  GatewayIntentBits,
  Collection,
  ActivityType,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder
} = require("discord.js");

const fs = require("node:fs");
const path = require("node:path");

require("dotenv").config();

const { loadCommands } = require("./handlers/commandHandler");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

const configPath = path.join(__dirname, "data", "ticket-config.json");

function getConfigs() {
  if (!fs.existsSync(configPath)) return {};
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

async function createTranscript(channel) {
  const messages = [];
  let before;

  while (true) {
    const options = { limit: 100 };
    if (before) options.before = before;

    const batch = await channel.messages.fetch(options);

    if (batch.size === 0) break;

    messages.push(...batch.values());

    before = batch.last().id;

    if (batch.size < 100) break;
  }

  messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  const lines = [
    `TIXORA TICKET TRANSCRIPT`,
    `Server: ${channel.guild.name}`,
    `Channel: #${channel.name}`,
    `Ticket ID: ${channel.id}`,
    `Created: ${channel.createdAt.toISOString()}`,
    `Transcript generated: ${new Date().toISOString()}`,
    "----------------------------------------",
    ""
  ];

  for (const message of messages) {
    const timestamp = message.createdAt.toISOString();
    const author = `${message.author.tag} (${message.author.id})`;

    lines.push(`[${timestamp}] ${author}`);

    if (message.content) {
      lines.push(message.content);
    }

    if (message.embeds.length > 0) {
      lines.push("[Message contains an embed]");
    }

    for (const attachment of message.attachments.values()) {
      lines.push(`[Attachment: ${attachment.name || "File"}]`);
      lines.push(attachment.url);
    }

    if (message.stickers.size > 0) {
      lines.push("[Message contains a sticker]");
    }

    lines.push("");
  }

  return Buffer.from(lines.join("\n"), "utf8");
}

async function startBot() {
  try {
    await loadCommands(client);
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    console.error("TIXORA STARTUP ERROR:", error);
    process.exit(1);
  }
}

client.once("ready", () => {
  console.log("--------------------------------");
  console.log(`Tixora is online as ${client.user.tag}`);
  console.log(`Serving ${client.guilds.cache.size} servers`);
  console.log("--------------------------------");

  client.user.setPresence({
    activities: [{
      name: "support tickets",
      type: ActivityType.Watching
    }],
    status: "online"
  });
});

client.on("interactionCreate", async interaction => {

  // Slash commands
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      return interaction.reply({
        content: "That command could not be found.",
        ephemeral: true
      });
    }

    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error("COMMAND ERROR:", error);

      const response = {
        content: "Tixora encountered an error running that command.",
        ephemeral: true
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(response).catch(console.error);
      } else {
        await interaction.reply(response).catch(console.error);
      }
    }

    return;
  }

  // Ticket category dropdown
  if (
    interaction.isStringSelectMenu() &&
    interaction.customId === "tixora_ticket_category"
  ) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const configs = getConfigs();
      const config = configs[interaction.guild.id];

      if (!config) {
        return interaction.editReply(
          "Tixora hasn't been configured. Ask an administrator to run /setup-tickets."
        );
      }

      const staffRole = interaction.guild.roles.cache.get(config.staffRoleId);

      if (!staffRole) {
        return interaction.editReply(
          "The configured staff role no longer exists."
        );
      }

      const existingTicket = interaction.guild.channels.cache.find(channel =>
        channel.type === ChannelType.GuildText &&
        channel.topic?.includes(`Ticket owner: ${interaction.user.id}`)
      );

      if (existingTicket) {
        return interaction.editReply(
          `You already have an open ticket: ${existingTicket}`
        );
      }

      const categories = {
        general: "General Support",
        technical: "Technical Support",
        account: "Account Assistance",
        partnerships: "Partnerships",
        other: "Other Inquiries"
      };

      const categoryName = categories[interaction.values[0]];

      if (!categoryName) {
        return interaction.editReply("That ticket category is invalid.");
      }

      const ticketChannel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-")
          .slice(0, 90),
        type: ChannelType.GuildText,
        topic: `Ticket owner: ${interaction.user.id} | Category: ${categoryName}`,
        permissionOverwrites: [
          {
            id: interaction.guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          },
          {
            id: staffRole.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          },
          {
            id: client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageChannels
            ]
          }
        ]
      });

      const ticketEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("Tixora Support Ticket")
        .setDescription(
          `Welcome ${interaction.user}!\n\n` +
          `**Category:** ${categoryName}\n` +
          `**Staff Team:** ${staffRole}\n\n` +
          "Please describe your issue. A staff member will assist you soon."
        )
        .setFooter({ text: "Tixora Support System" })
        .setTimestamp();

      const claimButton = new ButtonBuilder()
        .setCustomId("tixora_claim_ticket")
        .setLabel("Claim Ticket")
        .setEmoji("📌")
        .setStyle(ButtonStyle.Primary);

      const closeButton = new ButtonBuilder()
        .setCustomId("tixora_close_ticket")
        .setLabel("Close Ticket")
        .setEmoji("🔒")
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(
        claimButton,
        closeButton
      );

      await ticketChannel.send({
        content: `${interaction.user} ${staffRole}`,
        embeds: [ticketEmbed],
        components: [row]
      });

      await interaction.editReply(
        `Your ticket has been created: ${ticketChannel}`
      );

    } catch (error) {
      console.error("TICKET CREATION ERROR:", error);

      await interaction.editReply(
        "Tixora couldn't create your ticket. Please check its server permissions."
      ).catch(console.error);
    }

    return;
  }

  // Claim ticket button
  if (
    interaction.isButton() &&
    interaction.customId === "tixora_claim_ticket"
  ) {
    try {
      const channel = interaction.channel;

      if (!channel?.topic?.includes("Ticket owner:")) {
        return interaction.reply({
          content: "This is not a valid Tixora ticket.",
          ephemeral: true
        });
      }

      const configs = getConfigs();
      const config = configs[interaction.guild.id];
      const staffRole = config
        ? interaction.guild.roles.cache.get(config.staffRoleId)
        : null;

      if (!staffRole) {
        return interaction.reply({
          content: "The configured staff role could not be found.",
          ephemeral: true
        });
      }

      const member = await interaction.guild.members.fetch(interaction.user.id);

      if (!member.roles.cache.has(staffRole.id)) {
        return interaction.reply({
          content: "Only support staff can claim tickets.",
          ephemeral: true
        });
      }

      if (channel.topic.includes("Claimed by:")) {
        return interaction.reply({
          content: "This ticket has already been claimed.",
          ephemeral: true
        });
      }

      await channel.setTopic(
        `${channel.topic} | Claimed by: ${interaction.user.id}`
      );

      const claimedButton = new ButtonBuilder()
        .setCustomId("tixora_claimed")
        .setLabel(`Claimed by ${interaction.user.username}`.slice(0, 80))
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success)
        .setDisabled(true);

      const closeButton = new ButtonBuilder()
        .setCustomId("tixora_close_ticket")
        .setLabel("Close Ticket")
        .setEmoji("🔒")
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(
        claimedButton,
        closeButton
      );

      await interaction.update({
        components: [row]
      });

      await channel.send(
        `📌 This ticket has been claimed by ${interaction.user}.`
      );

    } catch (error) {
      console.error("TICKET CLAIM ERROR:", error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Tixora couldn't claim this ticket.",
          ephemeral: true
        }).catch(console.error);
      }
    }

    return;
  }

  // Close ticket button and save transcript
  if (
    interaction.isButton() &&
    interaction.customId === "tixora_close_ticket"
  ) {
    const channel = interaction.channel;

    if (
      !channel ||
      !channel.topic ||
      !channel.topic.includes("Ticket owner:")
    ) {
      return interaction.reply({
        content: "This button can only be used inside a Tixora ticket.",
        ephemeral: true
      });
    }

    try {
      const configs = getConfigs();
      const config = configs[interaction.guild.id];
      const staffRole = config
        ? interaction.guild.roles.cache.get(config.staffRoleId)
        : null;

      const isOwner = channel.topic.includes(
        `Ticket owner: ${interaction.user.id}`
      );

      const member = await interaction.guild.members.fetch(interaction.user.id);
      const isStaff = staffRole && member.roles.cache.has(staffRole.id);

      if (!isOwner && !isStaff) {
        return interaction.reply({
          content: "Only the ticket owner or support staff can close this ticket.",
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const logChannel = interaction.guild.channels.cache.find(
        ch => ch.name === "ticket-logs" && ch.type === ChannelType.GuildText
      );

      if (!logChannel) {
        return interaction.editReply(
          "I couldn't find #ticket-logs. The ticket has been kept open."
        );
      }

      const transcriptBuffer = await createTranscript(channel);

      const transcriptFile = new AttachmentBuilder(transcriptBuffer, {
        name: `tixora-${channel.name}-${channel.id}.txt`
      });

      const transcriptEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("Ticket Transcript")
        .setDescription(
          `A ticket has been closed and its transcript has been saved.\n\n` +
          `**Ticket:** #${channel.name}\n` +
          `**Closed by:** ${interaction.user}\n` +
          `**Ticket ID:** ${channel.id}`
        )
        .setTimestamp();

      await logChannel.send({
        embeds: [transcriptEmbed],
        files: [transcriptFile]
      });

      await interaction.editReply(
        "Transcript saved successfully in #ticket-logs. This ticket will be deleted in 5 seconds."
      );

      setTimeout(() => {
        channel.delete("Ticket closed and transcript saved.")
          .catch(console.error);
      }, 5000);

    } catch (error) {
      console.error("TICKET TRANSCRIPT ERROR:", error);

      const errorMessage =
        "Tixora couldn't save the transcript. The ticket has been kept open.";

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorMessage).catch(console.error);
      } else {
        await interaction.reply({
          content: errorMessage,
          ephemeral: true
        }).catch(console.error);
      }
    }

    return;
  }
});

startBot();
