use anyhow::{Context, Result};
use apex_agent::key::{self, Source};
use apex_agent::{Provider, ProviderSet, model};
use apex_core::ApexPaths;

use crate::cli::Auth;

pub async fn run(auth: Auth) -> Result<i32> {
    let paths = ApexPaths::discover()?;
    let set = ProviderSet::load(&paths.providers_dir())?;

    match auth {
        Auth::Wrong(complaint) => {
            eprintln!("apex: {complaint}");
            Ok(2)
        }
        Auth::List => {
            let mut held = Vec::new();
            for provider in set.iter() {
                held.push((provider, key::find(provider)?.map(|kept| kept.from)));
            }
            print!("{}", spell_keys(&held));
            Ok(0)
        }
        Auth::Add(name) => add(&set, &name).await,
        Auth::Remove(name) => remove(&set, &name),
        Auth::Models(name) => models(&set, &name).await,
    }
}

pub fn spell_keys(held: &[(&Provider, Option<Source>)]) -> String {
    let widest = held.iter().map(|(provider, _)| provider.name.len()).max().unwrap_or(0);
    let mut lines = String::new();
    for (provider, from) in held {
        lines.push_str(&format!("{:widest$}  {}\n", provider.name, spell_holding(provider, *from)));
    }
    lines
}

pub fn spell_holding(provider: &Provider, from: Option<Source>) -> String {
    match from {
        Some(Source::Stored) => "kept".to_owned(),
        Some(Source::Environment) => match provider.env.as_deref() {
            Some(name) => format!("from {name}"),
            None => "from the environment".to_owned(),
        },
        None if provider.keyless => "no key needed".to_owned(),
        None => "no key yet".to_owned(),
    }
}

async fn add(set: &ProviderSet, name: &str) -> Result<i32> {
    let Some(provider) = found(set, name) else {
        return Ok(2);
    };
    if provider.keyless {
        println!("{} needs no key, it answers on {}", provider.name, spell_url(provider));
        return Ok(0);
    }

    let typed = rpassword::prompt_password(format!("key for {}: ", provider.name))
        .context("reading the key")?;
    let typed = typed.trim().to_owned();
    if typed.is_empty() {
        eprintln!("apex: nothing was typed, so nothing was kept");
        return Ok(2);
    }

    match count(provider, &typed).await {
        Ok(models) => {
            key::keep(&provider.name, &typed)?;
            println!("kept, {} answered with {models} models", provider.name);
            Ok(0)
        }
        Err(cause) => {
            eprintln!("apex: {} did not take that key: {cause:#}", provider.name);
            Ok(1)
        }
    }
}

fn remove(set: &ProviderSet, name: &str) -> Result<i32> {
    let Some(provider) = found(set, name) else {
        return Ok(2);
    };
    key::forget(&provider.name)?;
    println!("{} has no key here any more", provider.name);
    Ok(0)
}

async fn models(set: &ProviderSet, name: &str) -> Result<i32> {
    let Some(provider) = found(set, name) else {
        return Ok(2);
    };
    let held = match key::find(provider)? {
        Some(held) => held.key,
        None if provider.keyless => String::new(),
        None => {
            eprintln!(
                "apex: {} has no key yet, run apex auth add {}",
                provider.name, provider.name
            );
            return Ok(2);
        }
    };

    let listed = model::list(&provider.dial(&held)?).await?;
    let widest = listed.iter().map(|model| model.id.len()).max().unwrap_or(0);
    for model in listed {
        match model.context {
            Some(window) => println!("{:widest$}  {window}", model.id),
            None => println!("{}", model.id),
        }
    }
    Ok(0)
}

async fn count(provider: &Provider, key: &str) -> Result<usize> {
    Ok(model::list(&provider.dial(key)?).await?.len())
}

fn found<'a>(set: &'a ProviderSet, name: &str) -> Option<&'a Provider> {
    match set.get(name) {
        Some(provider) => Some(provider),
        None => {
            eprintln!("apex: there is no provider called {name}");
            eprintln!("apex: known ones are {}", spell_names(set));
            None
        }
    }
}

pub fn spell_names(set: &ProviderSet) -> String {
    set.iter().map(|provider| provider.name.as_str()).collect::<Vec<_>>().join(", ")
}

fn spell_url(provider: &Provider) -> String {
    provider.base_url.clone().unwrap_or_else(|| "its own address".to_owned())
}

#[cfg(test)]
#[path = "auth_tests.rs"]
mod tests;
