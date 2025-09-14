use cfg_if::cfg_if;
use leptos_use::use_media_query;

use leptos::{
    ev::MouseEvent,
    html::{Input, Textarea},
    prelude::{
        component, signal, view, AddAnyAttr, ClassAttribute, ElementChild, Get, GlobalAttributes,
        IntoView, NodeRef, NodeRefAttribute, OnAttribute, ServerFnError, Set, Update,
    },
    server,
    task::spawn_local,
};

use leptos_meta::{provide_meta_context, Body, Link, Stylesheet, Title};
use leptos_router::{
    components::{Route, Router, Routes},
    path,
};

use server_fn::{BoxedStream, Websocket};
use strum::IntoEnumIterator;

use futures_util::{stream::empty, StreamExt};

use crate::{
    chat::{ChatMessage, ChatText},
    realtime::bitcodec::BitcodeEncoding,
    scores::{House, HousesScores},
    validation::FromClient,
};

#[allow(unused_imports)]
use leptos::prelude::IntoAnyAttribute;

cfg_if! {
if #[cfg(feature = "ssr")] {
    use std::sync::Mutex;
    use actix_web::web::Data;
    use futures_util::stream::once;

    use leptos::prelude::ServerFnErrorErr;
    use leptos_actix::extract;

    use std::ops::Range;

    use crate::{realtime::observable::Observable, validation::ValidateInvariants};

    pub struct AppState {
        pub scores: Mutex<Observable<HousesScores>>,
        pub chat_messages: Mutex<Observable<Vec<ChatMessage>>>
    }

    impl AppState {
        pub fn new() -> Self {
            Self {
                scores:  Mutex::new(Observable::new(HousesScores::default())),
                chat_messages: Mutex::new(Observable::new(vec![]))
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

// #[component]
// fn HomePage() -> impl IntoView {
//     view! {
//         <Link rel="preconnect" href="https://fonts.googleapis.com"/>
//         <Link rel="preconnect" href="https://fonts.gstatic.com" crossorigin=""/>

//         <Stylesheet href="https://fonts.googleapis.com/css2?family=Caudex:ital,wght@0,400;0,700;1,400;1,700&family=Cinzel+Decorative:wght@400;700;900&family=Forum&family=Marcellus+SC&family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap"/>
//         <Stylesheet href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=keyboard_arrow_down,send,social_leaderboard"/>

//         <Body {..} class="grow-to-parent flex"/>

//         <div class="scoreboard-container">
//             <div class="stackable stack-2 mobile-dropdown">
//                 <button onclick="location.href='#chat-window'"><span
//                         class="material-symbols-outlined">keyboard_arrow_down</span></button>
//             </div>
//             <ScoreBoard class="stackable stack-1"/>
//         </div>
//         <div class="chat-window-container">
//             <ChatWindow />
//         </div>
//     }
// }

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

#[server(protocol = Websocket<BitcodeEncoding, BitcodeEncoding>)]
async fn stream_score(
    _input: BoxedStream<(), ServerFnError>,
) -> Result<BoxedStream<HousesScores, ServerFnError>, ServerFnError> {
    let app_state = extract::<Data<AppState>>().await?;
    let mut scores = app_state.scores.lock().map_err(|_| {
        ServerFnErrorErr::ServerError(
            "Couldn't obtain the Mutex protecting the house scores!".to_string(),
        )
    })?;

    Ok(scores.subscribe(1).map(Result::Ok).into())
}

#[server]
async fn add_score(scored: FromClient<House>) -> Result<(), ServerFnError> {
    let scored = scored.validate()?;

    let app_state: Data<AppState> = extract().await?;
    let mut score = app_state.scores.lock().map_err(|_| {
        ServerFnErrorErr::ServerError(
            "Couldn't obtain the Mutex protecting the house scores!".to_string(),
        )
    })?;

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

#[server(protocol = Websocket<BitcodeEncoding, BitcodeEncoding>)]
async fn stream_chat(
    _input: BoxedStream<(), ServerFnError>,
) -> Result<BoxedStream<Vec<ChatMessage>, ServerFnError>, ServerFnError> {
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

    let app_state = extract::<Data<AppState>>().await?;

    let mut chat_messages_observable = app_state.chat_messages.lock().map_err(|_| {
        ServerFnErrorErr::ServerError(
            "Couldn't obtain the Mutex protecting the chat messages!".to_string(),
        )
    })?;

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

    let live = chat_messages_observable.selecting_subscribe(
        |chat_messages| {
            chat_messages
                .last()
                .map(|latest_message| latest_message.clone())
                .as_slice()
                .to_vec()
        },
        BUFFER_CAPACITY,
    );

    Ok(once(async { backread }).chain(live).map(Result::Ok).into())
}

#[server]
async fn chat(chat_message: FromClient<ChatMessage>) -> Result<(), ServerFnError> {
    let chat_message = chat_message.validate()?;

    let app_state: Data<AppState> = extract().await?;
    let mut chat_messages = app_state.chat_messages.lock().map_err(|_| {
        ServerFnErrorErr::ServerError(
            "Couldn't obtain the Mutex protecting the chat messages!".to_string(),
        )
    })?;

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

    spawn_local(async move {
        let mut scores_stream = stream_score(empty().into())
            .await
            .expect("Couldn't get scores stream!");

        while let Some(Ok(current_score)) = scores_stream.next().await {
            scores_setter.set(current_score);
        }
    });

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
                                            add_score(house.into()).await.expect("Failed to increment score!");
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
fn ChatMessages() -> impl IntoView {
    let (chat_getter, chat_setter) = signal(Vec::<ChatMessage>::new());

    spawn_local(async move {
        let mut chat_stream = stream_chat(empty().into())
            .await
            .expect("Couldn't get the chat message stream!");

        while let Some(Ok(current_messages)) = chat_stream.next().await {
            chat_setter.update(move |chat| chat.extend(current_messages));
        }
    });

    view! {
        <div class="chat-messages">
                {
                    move ||
                        {
                            chat_getter
                                .get()
                                .iter()
                                .map(
                                    |chat_message| {
                                        let username = chat_message.username().as_ref().to_owned();

                                        view! {
                                            <div><span>{username}</span></div>
                                        }
                                    }
                                )
                                .collect::<Vec<_>>()
                        }
                }
        </div>
    }
}

#[component]
fn ChatWindow() -> impl IntoView {
    let needs_screen_keyboard = use_media_query("(pointer: coarse)");

    let chat_area_ref: NodeRef<Textarea> = NodeRef::new();
    let top_bar_ref: NodeRef<Input> = NodeRef::new();

    let send_listeners = move || {
        let send_chat_message: Box<dyn Fn()> = Box::new(move || {
            let chat_area = chat_area_ref
                .get()
                .expect("The chat textarea should have been loaded by now!");

            let chat_text = chat_area.value();

            let username = top_bar_ref
                .get()
                .expect("The top username bar should have loaded by now!")
                .value();

            chat_area.set_value("");

            spawn_local(async move {
                chat(
                    ChatMessage::new(username, chat_text)
                        .expect("Invalid chat text or username!")
                        .into(),
                )
                .await
                .expect("Failed to send chat message!");
            });
        });

        let empty: Box<dyn Fn()> = Box::new(|| {});

        if needs_screen_keyboard.get() {
            (send_chat_message, empty)
        } else {
            (empty, send_chat_message)
        }
    };

    view! {
        <div class="fill-parent chat-window" id="chat-window">
            <div class="top-bar">
                <input node_ref=top_bar_ref maxlength="20" class="fill-parent" placeholder="What username will you use?"></input>
            </div>
            <ChatMessages/>
            <div class="message-bar">
                {
                    move || {
                        let (mobile_send, desktop_send) = send_listeners();

                        view! {
                            <textarea on:keypress={
                                move |event| {
                                    if event.key() == "Enter" {
                                        event.prevent_default();
                                        desktop_send();
                                    }
                                }
                            } node_ref={chat_area_ref} maxlength={ChatText::MAX_LENGTH} placeholder="Cheer your house on!"></textarea>
                            <button on:click={move |_| mobile_send()} class="mobile-send-button"><span class="material-symbols-outlined">send</span></button>
                        }
                    }
                }
            </div>
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
