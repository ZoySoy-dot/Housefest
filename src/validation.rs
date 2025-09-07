use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FromClient<T> {
    value: T,
}

impl<T> From<T> for FromClient<T> {
    fn from(value: T) -> Self {
        FromClient { value }
    }
}

impl<T: ValidateInvariants<Validated = T>> ValidateInvariants for FromClient<T> {
    type Validated = T;
    type Error = T::Error;

    fn validate(self) -> Result<Self::Validated, Self::Error>
    where
        Self: Sized,
    {
        self.value.validate()
    }
}

pub trait ValidateInvariants {
    type Validated;
    type Error;

    fn validate(self) -> Result<Self::Validated, Self::Error>
    where
        Self: Sized;
}
