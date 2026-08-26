use std::time::Duration;

use anyhow::{Result, bail};
use rig_core::completion::ToolDefinition;
use serde::Deserialize;
use serde_json::{Value, json};

use super::asked;

const MOST_TEXT: usize = 30_000;
const WAIT: Duration = Duration::from_secs(30);

#[derive(Debug, Deserialize)]
struct Args {
    url: String,
}

pub fn offered() -> ToolDefinition {
    ToolDefinition {
        name: "fetch".to_owned(),
        description: "Fetch a web page and get back its text, without the markup.".to_owned(),
        parameters: json!({
            "type": "object",
            "properties": {
                "url": { "type": "string", "description": "The http or https address to fetch." }
            },
            "required": ["url"]
        }),
    }
}

pub async fn run(args: &Value) -> Result<String> {
    let args: Args = asked(args)?;
    let url = reachable(args.url.trim())?;

    let answer = reqwest::Client::builder()
        .timeout(WAIT)
        .build()?
        .get(url.clone())
        .header("accept", "text/html,text/plain,application/json;q=0.9,*/*;q=0.5")
        .send()
        .await?;

    let code = answer.status();
    let kind = answer
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|kind| kind.to_str().ok())
        .unwrap_or_default()
        .to_owned();
    if !wordy(&kind) {
        bail!("{url} answered with {kind}, which is not text")
    }

    let body = answer.text().await?;
    Ok(spell(&url, code.as_u16(), &kind, &body))
}

fn reachable(url: &str) -> Result<String> {
    if url.is_empty() {
        bail!("fetch needs an address")
    }
    let parsed = url::Url::parse(url)
        .map_err(|cause| anyhow::anyhow!("{url} is not an address: {cause}"))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        bail!("fetch only speaks http and https, not {}", parsed.scheme())
    }
    Ok(parsed.to_string())
}

fn wordy(kind: &str) -> bool {
    let kind = kind.to_lowercase();
    kind.is_empty()
        || kind.starts_with("text/")
        || kind.contains("json")
        || kind.contains("xml")
        || kind.contains("javascript")
}

fn spell(url: &str, code: u16, kind: &str, body: &str) -> String {
    let text = match kind.to_lowercase().contains("html") {
        true => strip(body),
        false => body.trim().to_owned(),
    };
    let text = clipped(&text);
    match text.is_empty() {
        true => format!("{url}, {code}, nothing readable came back\n"),
        false => format!("{url}, {code}\n{text}\n"),
    }
}

fn clipped(text: &str) -> String {
    match text.chars().count() > MOST_TEXT {
        true => {
            let kept: String = text.chars().take(MOST_TEXT).collect();
            format!("{kept}\n… cut here …")
        }
        false => text.to_owned(),
    }
}

fn strip(html: &str) -> String {
    let without = drop_blocks(html);
    let mut text = String::with_capacity(without.len());
    let mut inside = false;
    for letter in without.chars() {
        match letter {
            '<' => inside = true,
            '>' => {
                inside = false;
                text.push(' ');
            }
            other if !inside => text.push(other),
            _ => {}
        }
    }
    tidy(&unescape(&text))
}

fn drop_blocks(html: &str) -> String {
    let mut kept = String::with_capacity(html.len());
    let mut rest = html;
    while let Some(open) = next_block(rest) {
        let (at, tag) = open;
        kept.push_str(&rest[..at]);
        let after = &rest[at..];
        let closing = format!("</{tag}");
        rest = match after.to_lowercase().find(&closing) {
            Some(end) => &after[end..],
            None => "",
        };
    }
    kept.push_str(rest);
    kept
}

fn next_block(html: &str) -> Option<(usize, &'static str)> {
    let low = html.to_lowercase();
    ["script", "style", "noscript", "svg"]
        .into_iter()
        .filter_map(|tag| low.find(&format!("<{tag}")).map(|at| (at, tag)))
        .min_by_key(|(at, _)| *at)
}

fn unescape(text: &str) -> String {
    text.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
}

fn tidy(text: &str) -> String {
    let mut lines: Vec<String> = Vec::new();
    for line in text.lines() {
        let squeezed = line.split_whitespace().collect::<Vec<_>>().join(" ");
        if squeezed.is_empty() && lines.last().is_some_and(String::is_empty) {
            continue;
        }
        lines.push(squeezed);
    }
    lines.join("\n").trim().to_owned()
}

#[cfg(test)]
#[path = "fetch_tests.rs"]
mod tests;
