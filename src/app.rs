use cfg_if::cfg_if;

#[allow(unused_imports)]
use leptos::{
    ev::MouseEvent,
    prelude::{
        component, signal, view, AddAnyAttr, ClassAttribute, ElementChild, FromServerFnError, Get,
        GlobalAttributes, IntoAnyAttribute, IntoView, OnAttribute, ServerFnError, ServerFnErrorErr,
        Set, Update,
    },
    server,
    task::spawn_local,
};
use leptos::{
    html::Textarea,
    prelude::{NodeRef, NodeRefAttribute},
};
use leptos_meta::{provide_meta_context, Body, Link, Stylesheet, Title};
use leptos_router::{
    components::{Route, Router, Routes},
    path,
};

use async_stream::stream;
use regex::Regex;
use serde::{Deserialize, Serialize};
use server_fn::codec::JsonEncoding;
use strum::{AsRefStr, EnumIter, IntoEnumIterator};

use crate::realtime::bitcodec::{BitcodeStream, StreamingBitcode};

use std::{
    ops::{Range, RangeInclusive},
    sync::OnceLock,
};
use thiserror::Error as ThisError;

use futures_util::{stream::once, StreamExt};
use leptos::logging::log;

#[derive(Default, Serialize, Deserialize, Clone, Debug)]
pub struct HousesScores {
    pub benilde: i32,
    pub jaime: i32,
    pub mutien: i32,
    pub miguel: i32,
}

impl HousesScores {
    fn get(&self, house: House) -> i32 {
        use House as H;

        match house {
            H::Benilde => self.benilde,
            H::Jaime => self.jaime,
            H::Miguel => self.miguel,
            H::Mutien => self.mutien,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, AsRefStr, EnumIter)]
#[strum(serialize_all = "kebab-case")]
enum House {
    Benilde,
    Jaime,
    Mutien,
    Miguel,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Username(String);

#[derive(ThisError, Debug, Serialize, Deserialize)]
enum UsernameError {
    #[error("You must have a username that's between 2 and 32 characters!")]
    InvalidLength,
    #[error("You can only have usernames that contain letters, digits, periods, and underscores.")]
    InvalidCharacters,
}

impl Username {
    const LENGTH_RANGE: RangeInclusive<usize> = (0..=32);

    fn username_validator() -> &'static Regex {
        static USERNAME_VALIDATOR: OnceLock<Regex> = OnceLock::new();

        USERNAME_VALIDATOR.get_or_init(|| {
            Regex::new(r"^[a-zA-Z0-9._]{2,32}$").expect("This should be a valid Regex!")
        })
    }

    fn is_valid(username: impl AsRef<str>) -> Result<(), UsernameError> {
        let username = username.as_ref();

        use UsernameError as UE;

        if !Self::LENGTH_RANGE.contains(&username.len()) {
            return Err(UE::InvalidLength);
        }

        if !Self::username_validator().is_match(username) {
            return Err(UE::InvalidCharacters);
        }

        Ok(())
    }

    fn new(username: String) -> Result<Username, UsernameError> {
        Self::is_valid(&username).map(|_| Username(username))
    }
}

impl Revalidate for Username {
    type Error = UsernameError;

    fn revalidate(self) -> Result<Self, Self::Error>
    where
        Self: Sized,
    {
        Username::new(self.0)
    }
}

#[derive(ThisError, Debug, Serialize, Deserialize)]
enum ChatTextError {
    #[error("Chat messages must be at most 500 characters.")]
    InvalidLength,
    #[error("You can only have visible ascii characters, spaces, and newlines in your messages!")]
    InvalidCharacters,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChatText(String);

impl ChatText {
    const MAX_LENGTH: usize = 500;

    fn is_valid(message: impl AsRef<str>) -> Result<(), ChatTextError> {
        let message = message.as_ref();

        use ChatTextError as CTE;

        if message.len() > Self::MAX_LENGTH {
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

impl Revalidate for ChatText {
    type Error = ChatTextError;

    fn revalidate(self) -> Result<Self, Self::Error>
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
    fn new(username: String, message: String) -> Result<Self, ChatMessageError> {
        Ok(ChatMessage {
            username: Username::new(username)?,
            message: ChatText::new(message)?,
        })
    }
}

impl Revalidate for ChatMessage {
    type Error = ChatMessageError;

    fn revalidate(self) -> Result<Self, Self::Error>
    where
        Self: Sized,
    {
        Self::new(self.username.0, self.message.0)
    }
}

#[derive(ThisError, Debug, Serialize, Deserialize)]
enum ChatMessageError {
    #[error(transparent)]
    UsernameError(#[from] UsernameError),
    #[error(transparent)]
    ChatTextError(#[from] ChatTextError),
}

#[derive(ThisError, Debug, Serialize, Deserialize)]
enum ServerChatMessageError {
    #[error(transparent)]
    ServerFnError(#[from] ServerFnErrorErr),
    #[error(transparent)]
    ChatMessageError(#[from] ChatMessageError),
}

impl FromServerFnError for ServerChatMessageError {
    type Encoder = JsonEncoding;

    fn from_server_fn_error(value: ServerFnErrorErr) -> Self {
        ServerChatMessageError::ServerFnError(value)
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct FromClient<T> {
    value: T,
}

impl<T: Revalidate> FromClient<T> {
    fn revalidate(self) -> Result<T, T::Error> {
        self.value.revalidate()
    }
}

trait Revalidate {
    type Error;
    fn revalidate(self) -> Result<Self, Self::Error>
    where
        Self: Sized;
}

cfg_if! {
if #[cfg(feature = "ssr")] {
    use crate::realtime::observable::Observable;
    use std::sync::Mutex;

    pub struct AppState {
        pub scores: Mutex<Observable<HousesScores>>,
        pub chat_messages: Mutex<Observable<Vec<ChatMessage>>>
    }

    impl AppState {
        pub fn new() -> Self {
            Self {
                scores:  Mutex::new(Observable::new(HousesScores::default())),
                chat_messages: Mutex::new(Observable::new(vec![ChatMessage::new("1asdf".to_string(), "asdf".to_string()).expect("This should be a valid chat message!"), ChatMessage::new("asdf".to_string(), "asdf".to_string()).expect("This should be a valid chat message!")]))
            }
        }
    }
}
}

#[component]
pub fn App() -> impl IntoView {
    provide_meta_context();

    view! {
        <Stylesheet id="leptos" href="/pkg/realtime-housefest.css"/>

        <Title text="Realtime Housefest!"/>

        /*
        Why is [NotFound] used twice?

        Well, it has to do with client and server side rendering.
        In server side applications, only the routes under [Routes] get registered to be served.
        For non-matching routes, the server provides its own 404 fallback.
        That's why we also have to provide a wildcard matcher so that [leptos_router] gets registered
        to handle every route.

        In client side only applications, [fallback] should work as expected because [leptos_router]
        gets to handle every route by default. (This is speculation on my part though!)
        */
        <Router>
            <Routes fallback=NotFound>
                <Route path=path!("/") view=HomePage/>
                <Route path=path!("/*any") view=NotFound/>
            </Routes>
        </Router>
    }
}

#[server(output = StreamingBitcode)]
async fn stream_score() -> Result<BitcodeStream<HousesScores>, ServerFnError> {
    use actix_web::web::Data;
    use leptos_actix::extract;

    let app_state = extract::<Data<AppState>>().await?;
    let mut scores = app_state
        .scores
        .lock()
        .expect("Couldn't obtain the Mutex protecting the house scores!");

    Ok(BitcodeStream::from(scores.subscribe(1)))
}

#[server]
async fn add_score(scored: House) -> Result<(), ServerFnError> {
    use actix_web::web::Data;
    use leptos_actix::extract;

    let app_state: Data<AppState> = extract().await?;
    let mut score = app_state
        .scores
        .lock()
        .expect("Couldn't obtain the Mutex protecting the house scores!");

    score.update(move |house_scores: &mut HousesScores| {
        use House as H;

        let house_score = match scored {
            H::Jaime => &mut house_scores.jaime,
            H::Benilde => &mut house_scores.benilde,
            H::Miguel => &mut house_scores.miguel,
            H::Mutien => &mut house_scores.mutien,
        };

        *house_score += 1;
    });

    Ok(())
}

trait Subslice<T> {
    fn subslice(&self, range: Range<isize>) -> Option<&[T]>;
}

impl<T> Subslice<T> for [T] {
    fn subslice(&self, range: Range<isize>) -> Option<&[T]> {
        if self.len() > (isize::MAX as usize) {
            panic!("We don't support this size of slice!");
        }

        let len = self.len() as isize;

        if range.start < 0 || range.end < range.start || range.end > len {
            return None;
        }

        self.get((range.start as usize)..(range.end as usize))
    }
}

#[server(output = StreamingBitcode)]
async fn stream_chat() -> Result<BitcodeStream<Vec<ChatMessage>>, ServerFnError> {
    use actix_web::web::Data;
    use leptos_actix::extract;
    use tokio::task::yield_now;

    let app_state = extract::<Data<AppState>>().await?;

    let mut chat_messages_observable = app_state
        .chat_messages
        .lock()
        .expect("Couldn't obtain the Mutex protecting the chat messages!");

    let chat_messages = chat_messages_observable.get();

    const BACKREAD_MESSAGES_COUNT: isize = 50; // Arbitrary.
    const BUFFER_CAPACITY: usize = 27; // Sections in DLSU SHS are usually 25-30 students.

    let backread = chat_messages
        .subslice(
            (chat_messages
                .len()
                .saturating_sub(BACKREAD_MESSAGES_COUNT as usize) as isize)
                ..(chat_messages.len() as isize - 1), // The [selecting_subscribe] will broadcast the latest message.
        )
        .unwrap_or(&[])
        .to_vec();

    let updates = chat_messages_observable.selecting_subscribe(
        |chat_messages| {
            chat_messages
                .last()
                .map(|latest_message| latest_message.clone())
                .as_slice()
                .to_vec()
        },
        BUFFER_CAPACITY,
    );

    drop(chat_messages_observable);

    let a = once(async { backread }).chain(updates);

    // for _ in 0..10 {
    //     if let Some(b) = a.next().await {
    //         log!("[server] read from stream: {:?}", b);
    //     }

    //     break;
    // }

    Ok(BitcodeStream::from(a))
}

#[server]
async fn chat(chat_message: FromClient<ChatMessage>) -> Result<(), ServerChatMessageError> {
    use actix_web::web::Data;
    use leptos_actix::extract;

    let chat_message = chat_message.revalidate()?;

    let app_state: Data<AppState> = extract().await?;
    let mut chat_messages = app_state
        .chat_messages
        .lock()
        .expect("Couldn't obtain the Mutex protecting the chat messages!");

    chat_messages.update(move |chat_messages: &mut Vec<ChatMessage>| {
        chat_messages.push(chat_message);
    });

    Ok(())
}

#[component]
fn ScoreCard(
    house: House,
    on_score: impl FnMut(MouseEvent) + 'static,
    score: i32,
) -> impl IntoView {
    let name = house.as_ref();

    trait Capitalize {
        fn capitalize(&self) -> String;
    }

    impl Capitalize for str {
        fn capitalize(&self) -> String {
            let mut chars = self.chars();

            let Some(first_char) = chars.next() else {
                return String::new();
            };

            first_char.to_uppercase().chain(chars).collect::<String>()
        }
    }

    view! {
        <div class={format!("score-card {name}")}>
            <h1>{name.capitalize()}</h1>
            <h1>{score}</h1>
            <button class="add-score" on:click=on_score><span class="material-symbols-outlined">social_leaderboard</span></button>
        </div>
    }
}

#[component]
fn ScoreBoard(class: impl AsRef<str>) -> impl IntoView {
    let (scores_getter, scores_setter) = signal(HousesScores::default());

    // spawn_local(async move {
    //     let mut scores_stream = stream_score()
    //         .await
    //         .expect("Couldn't get scores stream!")
    //         .into_inner();

    //     while let Some(Ok(current_score)) = scores_stream.next().await {
    //         scores_setter.set(current_score);
    //     }
    // });

    view! {
        <div class={format!("{} fill-parent scoreboard", class.as_ref())}>
            {
                move || {
                    let scores = scores_getter.get();

                    House::iter()
                        .map(
                            |house|
                                view! {
                                    <ScoreCard house=house on_score=move |_| {
                                        spawn_local(async move {
                                            add_score(house).await.expect("Failed to increment score!");
                                        });
                                    } score=scores.get(house)/>
                                }
                        ).collect::<Vec<_>>()
                }
            }
        </div>
    }
}

#[component]
fn ChatWindow() -> impl IntoView {
    let (chat_getter, chat_setter) = signal(Vec::<ChatMessage>::new());

    spawn_local(async move {
        let maybe_chat_stream = stream_chat().await;

        log!("{:?}", maybe_chat_stream);

        let mut chat_stream = maybe_chat_stream
            .expect("Couldn't get chat stream!")
            .into_inner();

        log!("2");

        loop {
            log!("3");
            let maybe_message = chat_stream.next().await;

            log!("4");

            if let Some(Ok(current_messages)) = maybe_message {
                log!("5");
                chat_setter.update(move |chat| chat.extend(current_messages));
                continue;
            }

            log!("6");
            log!("{:?}", maybe_message);
            break;
        }

        log!("7");
    });

    let chat_input: NodeRef<Textarea> = NodeRef::new();

    view! {
        <div class="fill-parent chat-window" id="chat-window">
            <div class="top-bar">
                <input maxlength="20" class="fill-parent" placeholder="What username will you use?"></input>
            </div>
            <div class="chat-messages">
                {
                    move ||
                        {
                            chat_getter
                                .get()
                                .iter()
                                .map(
                                    |chat_message|
                                        view! {
                                            <div>{format!("{:?}", chat_message)}</div>
                                        }
                                )
                                .collect::<Vec<_>>()
                        }
                }
            </div>
            <div class="message-bar">
                <textarea on:keydown=move |event| {
                    if event.key() == "Enter" && !event.shift_key() {
                        event.prevent_default();

                        spawn_local(
                            async move {
                                chat(
                                    FromClient { value: ChatMessage::new("testu".to_string(), "testm".to_string()).expect("should be valid!") }
                                )
                                .await
                                .expect("Failed to send chat message!");
                            }
                        );
                    }
                }  maxlength={ChatText::MAX_LENGTH} placeholder="Cheer your house on!" node_ref=chat_input></textarea>
                <button><span class="material-symbols-outlined">send</span></button>
            </div>
        </div>
    }
}

#[component]
fn HomePage() -> impl IntoView {
    view! {
        <Link rel="preconnect" href="https://fonts.googleapis.com"/>
        <Link rel="preconnect" href="https://fonts.gstatic.com" crossorigin=""/>

        <Stylesheet href="https://fonts.googleapis.com/css2?family=Caudex:ital,wght@0,400;0,700;1,400;1,700&family=Cinzel+Decorative:wght@400;700;900&family=Forum&family=Marcellus+SC&family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap"/>
        <Stylesheet href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=keyboard_arrow_down,send,social_leaderboard"/>

        <Body {..} class="grow-to-parent flex"/>

        <div class="scoreboard-container">
            <div class="stackable stack-2 mobile-dropdown">
                <button onclick="location.href='#chat-window'"><span
                        class="material-symbols-outlined">keyboard_arrow_down</span></button>
            </div>
            <ScoreBoard class="stackable stack-1"/>
        </div>
        <div class="chat-window-container">
            <ChatWindow />
        </div>
    }
}

/// 404 - Not Found
#[component]
fn NotFound() -> impl IntoView {
    // set an HTTP status code 404
    // this is feature gated because it can only be done during
    // initial server-side rendering
    // if you navigate to the 404 page subsequently, the status
    // code will not be set because there is not a new HTTP request
    // to the server

    #[cfg(feature = "ssr")]
    {
        // this can be done inline because it's synchronous
        // if it were async, we'd use a server function

        let resp = leptos::prelude::expect_context::<leptos_actix::ResponseOptions>();
        resp.set_status(actix_web::http::StatusCode::NOT_FOUND);
    }

    view! {
        <h1>"Not Found"</h1>
    }
}
