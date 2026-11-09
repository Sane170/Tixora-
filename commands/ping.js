
module.exports = {
  name: "ping",
  description: "Check Tixora's response speed.",

  async execute(interaction, client) {
    const latency = client.ws.ping;

    await interaction.reply({
      embeds: [
        {
          color: 0x5865F2,
          title: "Tixora Status",
          description: "Tixora is online and responding!",
          fields: [
            {
              name: "WebSocket Latency",
              value: `${latency}ms`,
              inline: true
            },
            {
              name: "Status",
              value: "Online",
              inline: true
            }
          ],
          footer: {
            text: "Tixora Support System"
          },
          timestamp: new Date().toISOString()
        }
      ]
    });
  }
};
