use serde::{Deserialize, Serialize};
use strum::{AsRefStr, EnumIter, IntoEnumIterator};
use thiserror::Error as ThisError;

use crate::validation::ValidateInvariants;

#[derive(Default, Serialize, Deserialize, Clone, Debug)]
pub struct HousesScores {
    pub benilde: i32,
    pub jaime: i32,
    pub mutien: i32,
    pub miguel: i32,
}

impl HousesScores {
    pub fn get(&self, house: House) -> i32 {
        use House as H;

        match house {
            H::Benilde => self.benilde,
            H::Jaime => self.jaime,
            H::Miguel => self.miguel,
            H::Mutien => self.mutien,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, AsRefStr, EnumIter, PartialEq)]
// #[serde(rename_all = "kebab-case")]
#[strum(serialize_all = "kebab-case")]
pub enum House {
    Benilde,
    Jaime,
    Mutien,
    Miguel,
}

#[derive(ThisError, Debug, Serialize, Deserialize)]
pub enum InvalidHouseError {
    #[error("The enum's discriminant is invalid!")]
    InvalidHouse,
}

impl ValidateInvariants for House {
    type Validated = Self;
    type Error = InvalidHouseError;

    fn validate(self) -> Result<Self::Validated, Self::Error>
    where
        Self: Sized,
    {
        for variant in Self::iter() {
            if self == variant {
                return Ok(self);
            }
        }

        return Err(InvalidHouseError::InvalidHouse);
    }
}
