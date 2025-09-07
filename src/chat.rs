use crate::validation::ValidateInvariants;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::ops::RangeInclusive;
use std::sync::OnceLock;
use thiserror::Error as ThisError;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Username(String);

#[derive(ThisError, Debug, Serialize, Deserialize)]
pub enum UsernameError {
    #[error("You must have a username that's between 2 and 32 characters!")]
    InvalidLength,
    #[error("You can only have usernames that contain letters, digits, periods, and underscores.")]
    InvalidCharacters,
}

impl Username {
    const LENGTH_RANGE: RangeInclusive<usize> = (2..=32);

    fn character_validator() -> &'static Regex {
        static USERNAME_VALIDATOR: OnceLock<Regex> = OnceLock::new();

        USERNAME_VALIDATOR
            .get_or_init(|| Regex::new(r"^[a-zA-Z0-9._]+$").expect("This should be a valid Regex!"))
    }

    fn is_valid(username: impl AsRef<str>) -> Result<(), UsernameError> {
        let username = username.as_ref();

        use UsernameError as UE;

        if !Self::LENGTH_RANGE.contains(&username.len()) {
            return Err(UE::InvalidLength);
        }

        if !Self::character_validator().is_match(username) {
            return Err(UE::InvalidCharacters);
        }

        Ok(())
    }

    fn new(username: String) -> Result<Username, UsernameError> {
        Self::is_valid(&username).map(|_| Username(username))
    }
}

impl AsRef<str> for Username {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl ValidateInvariants for Username {
    type Validated = Self;
    type Error = UsernameError;

    fn validate(self) -> Result<Self::Validated, Self::Error>
    where
        Self: Sized,
    {
        Username::new(self.0)
    }
}

#[derive(ThisError, Debug, Serialize, Deserialize)]
pub enum ChatTextError {
    #[error("Chat messages must be at most 500 characters.")]
    InvalidLength,
    #[error("You can only have visible ascii characters, spaces, and newlines in your messages!")]
    InvalidCharacters,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChatText(String);

impl ChatText {
    pub const MAX_LENGTH: usize = 500;

    fn is_valid(message: impl AsRef<str>) -> Result<(), ChatTextError> {
        let message = message.as_ref();

        use ChatTextError as CTE;

        if message.is_empty() || message.len() > Self::MAX_LENGTH {
            return Err(CTE::InvalidLength);
        }

        let valid_chat_character =
            |character: char| character.is_ascii_graphic() || character == ' ' || character == '\n';

        if !message.chars().all(valid_chat_character) {
            return Err(CTE::InvalidCharacters);
        }

        Ok(())
    }

    fn new(message: String) -> Result<ChatText, ChatTextError> {
        Self::is_valid(&message).map(|_| ChatText(message))
    }
}

impl AsRef<str> for ChatText {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl ValidateInvariants for ChatText {
    type Validated = Self;
    type Error = ChatTextError;

    fn validate(self) -> Result<Self::Validated, Self::Error>
    where
        Self: Sized,
    {
        ChatText::new(self.0)
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChatMessage {
    username: Username,
    message: ChatText,
}

impl ChatMessage {
    pub fn new(username: String, message: String) -> Result<Self, ChatMessageError> {
        Ok(ChatMessage {
            username: Username::new(username)?,
            message: ChatText::new(message)?,
        })
    }

    pub fn username(&self) -> &Username {
        &self.username
    }

    pub fn message(&self) -> &ChatText {
        &self.message
    }
}

impl ValidateInvariants for ChatMessage {
    type Validated = Self;
    type Error = ChatMessageError;

    fn validate(self) -> Result<Self::Validated, Self::Error>
    where
        Self: Sized,
    {
        Self::new(self.username.0, self.message.0)
    }
}

#[derive(ThisError, Debug, Serialize, Deserialize)]
pub enum ChatMessageError {
    #[error(transparent)]
    UsernameError(#[from] UsernameError),
    #[error(transparent)]
    ChatTextError(#[from] ChatTextError),
}
