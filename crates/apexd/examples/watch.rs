use anyhow::Result;
use apex_core::ApexPaths;
use apex_proto::{ClientMessage, Hello, PROTOCOL_VERSION, ServerMessage, connect_unix};

#[tokio::main]
async fn main() -> Result<()> {
    let paths = ApexPaths::discover()?;
    eprintln!("socket: {}", paths.socket.display());
    let mut connection = connect_unix(&paths.socket).await?;
    connection
        .send_control(&ClientMessage::Hello(Hello {
            protocol_version: PROTOCOL_VERSION,
            client_name: "watch".into(),
            identity: None,
        }))
        .await?;
    while let Some(frame) = connection.recv().await {
        if let ServerMessage::Event(event) = frame?.parse_control::<ServerMessage>()? {
            println!("{event:?}");
        }
    }
    Ok(())
}
