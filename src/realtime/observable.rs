use cfg_if::cfg_if;

cfg_if! {
if #[cfg(feature = "ssr")] {

use std::task::{Context, Poll};
use std::pin::Pin;

use tokio::sync::mpsc::{channel, Sender, Receiver, error::TrySendError};
use futures_util::Stream;

pub trait AnyNotifier<T>: Send {
    fn notify(&mut self, state: &T) -> Result<(), TrySendError<()>>;
}

pub struct Notifier<U, S> {
    selector: S,
    notifier: Sender<U>
}

impl<T, U, S> AnyNotifier<T> for Notifier<U, S>
    where
        U: Send,
        S: FnMut(&T) -> U + Send {
    fn notify(&mut self, state: &T) -> Result<(), TrySendError<()>> {
        let permit = self.notifier.try_reserve()?;

        let selected = (self.selector)(state);

        permit.send(selected);

        Ok(())
    }
}

pub struct Observable<T>  {
    value: T,
    notifiers: Vec<Box<dyn AnyNotifier<T>>>
}

impl<T> Observable<T> {
    pub fn new(value: T) -> Self {
        Self::with_capacity(value, 0)
    }

    pub fn with_capacity(value: T, capacity: usize) -> Self {
        Self {
            value,
            notifiers: Vec::with_capacity(capacity)
        }
    }

    pub fn observer_count(&self) -> usize {
        self.notifiers.len()
    }

    pub fn get(&self) -> &T {
        &self.value
    }

    pub fn subscribe(&mut self, capacity: usize) -> impl Stream<Item = T> where T: Clone + Send + 'static {
        self.selecting_subscribe(T::clone, capacity)
    }

    pub fn selecting_subscribe<U: Send + 'static>(&mut self, selector: impl FnMut(&T) -> U + Send + 'static, capacity: usize) -> impl Stream<Item = U> {
        let (sender, subscriber) = channel(capacity);

        let mut notifier = Notifier {
            selector,
            notifier: sender
        };

        /*
        SAFETY: We know that the channel capacity is at least 1 [https://docs.rs/tokio/latest/tokio/sync/mpsc/fn.channel.html#panics]
        and we know that the buffer in subscriber is unoccupied because it had just been created.
        */
        unsafe { notifier.notify(&self.value).unwrap_unchecked(); }

        self.notifiers.push(
            Box::new(
                notifier
            )
        );

        ReceiverStream::new(subscriber)
    }

    pub fn update(&mut self, mutator: impl FnOnce(&mut T)) {
        mutator(&mut self.value);

        self.notifiers.retain_mut(
            |notifier| {
                let Err(TrySendError::Closed(_)) = notifier.notify(&self.value) else {
                    return true;
                };

                false
            }
        );
    }
}

#[derive(Debug)]
pub struct ReceiverStream<T> {
    inner: Receiver<T>,
}

impl<T> ReceiverStream<T> {
    /// Create a new `ReceiverStream`.
    pub fn new(recv: Receiver<T>) -> Self {
        Self { inner: recv }
    }

    /// Get back the inner `Receiver`.
    pub fn into_inner(self) -> Receiver<T> {
        self.inner
    }

    /// Closes the receiving half of a channel without dropping it.
    ///
    /// This prevents any further messages from being sent on the channel while
    /// still enabling the receiver to drain messages that are buffered. Any
    /// outstanding [`Permit`] values will still be able to send messages.
    ///
    /// To guarantee no messages are dropped, after calling `close()`, you must
    /// receive all items from the stream until `None` is returned.
    ///
    /// [`Permit`]: struct@tokio::sync::mpsc::Permit
    pub fn close(&mut self) {
        self.inner.close();
    }
}

impl<T> Stream for ReceiverStream<T> {
    type Item = T;

    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        self.inner.poll_recv(cx)
    }
}

}
}
