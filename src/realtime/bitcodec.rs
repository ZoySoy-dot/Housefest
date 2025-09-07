use bitcode::{deserialize, serialize, Error as BitcodeError};
use serde::{de::DeserializeOwned, Serialize};
use server_fn::{Bytes, ContentType, Decodes, Encodes, Format, FormatType};

pub struct BitcodeEncoding;

impl ContentType for BitcodeEncoding {
    const CONTENT_TYPE: &'static str = "application/octet-stream";
}

impl FormatType for BitcodeEncoding {
    const FORMAT_TYPE: Format = Format::Binary;
}

impl<T> Encodes<T> for BitcodeEncoding
where
    T: Serialize,
{
    type Error = BitcodeError;

    fn encode(output: &T) -> Result<Bytes, Self::Error> {
        serialize(output).map(Into::into)
    }
}

impl<T> Decodes<T> for BitcodeEncoding
where
    T: DeserializeOwned,
{
    type Error = BitcodeError;

    fn decode(bytes: Bytes) -> Result<T, Self::Error> {
        deserialize(&bytes)
    }
}

// /// Pass arguments and receive responses as JSON in the body of a `POST` request.
// pub type Json = Post<JsonEncoding>;

// /// Pass arguments and receive responses as JSON in the body of a `PATCH` request.
// /// **Note**: Browser support for `PATCH` requests without JS/WASM may be poor.
// /// Consider using a `POST` request if functionality without JS/WASM is required.
// pub type PatchJson = Patch<JsonEncoding>;

// /// Pass arguments and receive responses as JSON in the body of a `PUT` request.
// /// **Note**: Browser support for `PUT` requests without JS/WASM may be poor.
// /// Consider using a `POST` request if functionality without JS/WASM is required.
// pub type PutJson = Put<JsonEncoding>;

// use async_stream::try_stream;
// use bytes::{Bytes, BytesMut};
// use leptos::prelude::{FromServerFnError, ServerFnErrorErr};
// use leptos::server_fn::codec::{Encoding, FromReq, FromRes, IntoReq, IntoRes, Streaming};

// use leptos::server_fn::response::{ClientRes, TryRes};
// use leptos::server_fn::ContentType;
// use leptos::server_fn::{
//     error::ServerFnError,
//     request::{ClientReq, Req},
// };

// use futures_util::{Stream, StreamExt, stream::Map as StreamMap};
// use http::Method;
// use num_traits::ops::bytes::NumBytes;
// use num_traits::ToBytes;
// use num_traits::{ops::bytes::FromBytes, Bounded, Unsigned};
// use std::array::TryFromSliceError;
// use std::pin::{pin, Pin};

// use bitcode::{deserialize, serialize};
// use serde::{de::DeserializeOwned, Serialize};
// use std::fmt::{Debug, Formatter, Result as FmtResult};
// use pin_project::pin_project;

// pub struct StreamingBitcode;

// impl ContentType for StreamingBitcode {
//     const CONTENT_TYPE: &'static str = "application/octet-stream";
// }

// impl Encoding for StreamingBitcode {
//     const METHOD: Method = Method::POST;
// }

// pub struct BitcodeStream<T, E = ServerFnError>(Pin<Box<dyn Stream<Item = Result<T, E>> + Send>>);

// impl<T, E> BitcodeStream<T, E> {
//     pub fn into_inner(self) -> impl Stream<Item = Result<T, E>> + Send {
//         self.0
//     }
// }

// impl<T, E> Debug for BitcodeStream<T, E> {
//     fn fmt(&self, f: &mut Formatter<'_>) -> FmtResult {
//         f.debug_tuple("BitcodeStream").finish()
//     }
// }

// trait Header: Sized {
//     type Bytes: NumBytes + ?Sized;
//     type FromFrameSizeError;

//     fn max_chunk_size() -> usize;
//     fn size() -> usize;
//     fn from_bytes(bytes: &Self::Bytes) -> Self;
//     fn to_bytes(&self) -> Self::Bytes;
//     fn from_chunk_length(length: usize) -> Result<Self, Self::FromFrameSizeError>;
// }

// impl<T> Header for T
// where
//     T: Unsigned + Bounded + Into<usize> + FromBytes + ToBytes + TryFrom<usize>,
//     T: FromBytes<Bytes = <T as ToBytes>::Bytes>,
//     <T as FromBytes>::Bytes: Sized,
// {
//     type Bytes = <Self as FromBytes>::Bytes;
//     type FromFrameSizeError = <Self as TryFrom<usize>>::Error;

//     fn max_chunk_size() -> usize {
//         T::max_value().into()
//     }

//     fn size() -> usize {
//         size_of::<Self>()
//     }

//     fn from_bytes(bytes: &Self::Bytes) -> Self {
//         Self::from_le_bytes(bytes)
//     }

//     fn to_bytes(&self) -> Self::Bytes {
//         self.to_le_bytes()
//     }

//     fn from_chunk_length(length: usize) -> Result<Self, Self::FromFrameSizeError> {
//         TryFrom::try_from(length)
//     }
// }

// trait FramedStream {
//     type Header: Header;
// }

// impl<T, E> FramedStream for BitcodeStream<T, E> {
//     type Header = u16;
// }

// type BitcodeHeader = <BitcodeStream<(), ()> as FramedStream>::Header;

// impl<T, E> BitcodeStream<T, E> {
//     pub fn new(value: impl Stream<Item = Result<T, E>> + Send + 'static) -> Self {
//         Self(Box::pin(value))
//     }
// }

// impl<S, T: 'static, E: 'static> From<S> for BitcodeStream<T, E>
// where
//     S: Stream<Item = T> + Send + 'static,
// {
//     fn from(value: S) -> Self {
//         Self(Box::pin(value.map(Ok)))
//     }
// }

// pub struct Chunks<I> {
//     chunk_size: usize,
//     iter: I,
// }

// impl<I: Iterator> Iterator for Chunks<I> {
//     type Item = Vec<I::Item>;

//     fn next(&mut self) -> Option<Self::Item> {
//         // [chunk_size] will never be zero! See the implementation of [into_chunks].
//         let chunk: Vec<_> = self.iter.by_ref().take(self.chunk_size).collect();
//         if chunk.is_empty() { None } else { Some(chunk) }
//     }
// }

// pub trait ChunkExt: Iterator + Sized {
//     fn into_chunks(self, chunk_size: usize) -> Chunks<Self>;
// }

// impl<I: Iterator> ChunkExt for I {
//     fn into_chunks(self, chunk_size: usize) -> Chunks<Self> {
//         if chunk_size == 0 {
//             panic!("[chunk_size] can't be 0!");
//         }

//         Chunks {
//             iter: self,
//             chunk_size,
//         }
//     }
// }

// #[pin_project]
// pub struct Framed<S> {
//     #[pin]
//     inner: S,
// }

// impl<S> Framed<S> {
//     fn new<T>(stream: T) -> Framed<impl Stream<Item = Bytes>>
//     where
//         T: Stream<Item = Vec<u8>>,
//     {
//         Framed {
//             inner: stream.map(|bytes| {
//                 let max_chunk_size = BitcodeHeader::max_chunk_size();
//                 let byte_count = bytes.len();
//                 Bytes::from_iter(
//                     bytes
//                         .into_iter()
//                         .into_chunks(max_chunk_size)
//                         .flat_map(|chunk|
//                             BitcodeHeader::from_chunk_length(chunk.len())
//                                 .expect("Each chunk should have a maximum length of [BitcodeHeader::frame_size()]!")
//                                 .to_bytes()
//                                 .into_iter()
//                                 .chain(chunk.into_iter())
//                         )
//                         .chain(if byte_count % max_chunk_size == 0 {
//                             BitcodeHeader::from(0u16).to_be_bytes().to_vec()
//                         } else {
//                             vec![]
//                         }),
//                 )
//             }),
//         }
//     }
// }

// impl<B> Stream for Framed<B>
// where B: Stream<Item = Bytes> {
//     type Item = Bytes;

//     fn poll_next(self: Pin<&mut Self>, cx: &mut std::task::Context<'_>) -> std::task::Poll<Option<Self::Item>> {
//         let this = self.project();
//         this.inner.poll_next(cx)
//     }
// }

// pub trait FramedStreamExt: Stream<Item = Vec<u8>> + Sized {
//     fn framed(self) -> Framed<impl Stream<Item = Bytes>>
//     {
//         Framed::<Self>::new(self)
//     }
// }

// impl<S> FramedStreamExt for S where S: Stream<Item = Vec<u8>> {}

// impl<E, T, Response> IntoRes<StreamingBitcode, Response, E> for BitcodeStream<T, E>
// where
//     Response: TryRes<E>,
//     E: FromServerFnError,
//     T: Serialize + 'static,
// {
//     async fn into_res(self) -> Result<Response, E> {
//         Response::try_from_stream(
//             Streaming::CONTENT_TYPE,
//             self.into_inner()
//                 .map(
//                     |value| value.expect(
//                         "[value] should never be [Err]! See the [From] [Stream] to [BitcodeStream] trait."
//                     )
//                 ).map(
//                     |a| {}
//                 )

//             // .map(|value| {
//             //     let serialized = serialize(&value
//             //         .expect(
//             //             "[value] should never be [Err]! See the [From] [Stream] to [BitcodeStream] trait.")
//             //         )
//             //         .map_err(|e| {
//             //         E::from_server_fn_error(ServerFnErrorErr::Serialization(e.to_string())).ser()
//             //     })?;

//             //     let max_chunk_size = BitcodeHeader::max_chunk_size();

//             //     let serialized_byte_count = serialized.len();

//             //     Ok(Bytes::from_iter(
//             //         serialized
//             //             .into_iter()
//             //             .into_chunks(max_chunk_size)
//             //             .flat_map(
//             //                 |chunk|
//             //                     BitcodeHeader::
//             //                         from_chunk_length(chunk.len())
//             //                         .expect("Each chunk should have a maximum length of [BitcodeHeader::frame_size()]!")
//             //                         .to_bytes()
//             //                         .into_iter()
//             //                         .chain(chunk.into_iter())
//             //             )
//             //             .chain(if serialized_byte_count % max_chunk_size == 0 {
//             //                 BitcodeHeader::from(0u16).to_be_bytes().to_vec()
//             //             } else {
//             //                 vec![]
//             //             }),
//             //     ))
//             // }
//         )
//     }
// }

// struct Buffered<S> {
//     stream: S,
//     buffer: BytesMut,
// }

// impl<S: Stream<Item = Result<Bytes, Bytes>> + Send + Unpin> Buffered<S> {
//     fn new(stream: S) -> Self {
//         Buffered {
//             stream,
//             buffer: BytesMut::new(),
//         }
//     }

//     async fn take(&mut self, chunk_size: usize) -> Result<Option<BytesMut>, Bytes> {
//         Ok(match self.stream_in(chunk_size).await? {
//             0 => None,
//             available => {
//                 Some(self.buffer.split_to(available))
//             }
//         })
//     }

//     async fn take_peek(&mut self, chunk_size: usize) -> Result<Option<&[u8]>, Bytes> {
//         Ok(match self.stream_in(chunk_size).await? {
//             0 => None,
//             available => {
//                 Some(&self.buffer[..available])
//             }
//         })
//     }

//     // Returns a [usize] of the number of bytes available for a [chunk_size] read.
//     async fn stream_in(&mut self, chunk_size: usize) -> Result<usize, Bytes> {
//         let buffer = &mut self.buffer;

//         while buffer.len() < chunk_size {
//             match self.stream.next().await {
//                 Some(Ok(chunk)) => buffer.extend(chunk),
//                 Some(Err(error)) => return Err(error),
//                 None => {
//                     if buffer.is_empty() {
//                         return Ok(0);
//                     }

//                     return Ok(buffer.len())
//                 }
//             }
//         }

//         Ok(chunk_size)
//     }
// }

// impl<E, T, Response> FromRes<StreamingBitcode, Response, E> for BitcodeStream<T, E>
// where
//     Response: ClientRes<E> + Send,
//     T: DeserializeOwned,
//     E: FromServerFnError,
// {
//     async fn from_res(res: Response) -> Result<Self, E> {
//         async fn take<
//             S,
//             U,
//             E
//         >(buffered: &mut Buffered<S>, chunk_size: usize, op: impl FnOnce(BytesMut) -> Result<U, E>) ->
//             Result<Option<U>, E>
//          where S: Stream<Item = Result<Bytes, Bytes>> + Send + Unpin,
//             E: FromServerFnError {
//             buffered
//                 .take(chunk_size)
//                 .await
//                 .map_err(|bytes_error| E::de(bytes_error))
//                 .and_then(|maybe_bytes| maybe_bytes.map(op).transpose())
//         }

//         async fn peek<
//             S,
//             U,
//             E
//         >(buffered: &mut Buffered<S>, chunk_size: usize, op: impl FnOnce(&[u8]) -> Result<U, E>) ->
//             Result<Option<U>, E>
//          where S: Stream<Item = Result<Bytes, Bytes>> + Send + Unpin,
//             E: FromServerFnError {
//             buffered
//                 .take_peek(chunk_size)
//                 .await
//                 .map_err(|bytes_error| E::de(bytes_error))
//                 .and_then(|maybe_bytes| maybe_bytes.map(op).transpose())
//         }

//         fn parse_header<E>(chunk_size: &[u8]) -> Result<usize, E>
//         where E: FromServerFnError,
//         {
//             Ok(BitcodeHeader::from_bytes(
//                 chunk_size
//                     .try_into()
//                     .map_err(|_| {
//                         E::from_server_fn_error(
//                             ServerFnErrorErr::Deserialization(
//                                 "The stream ended before streaming an entire header!".to_string()
//                             )
//                         )
//                     })?
//             ) as usize)
//         }

//         async fn take_header<S, E>(buffered: &mut Buffered<S>) -> Result<Option<usize>, E>
//         where
//             S: Stream<Item = Result<Bytes, Bytes>> + Send + Unpin,
//             E: FromServerFnError,
//         {
//             take(
//                 buffered,
//                 BitcodeHeader::size(),
//                 |chunk_size: BytesMut| parse_header(chunk_size.as_ref())
//             ).await
//         }

//         async fn peek_header<S, E>(buffered: &mut Buffered<S>) -> Result<Option<usize>, E>
//         where
//             S: Stream<Item = Result<Bytes, Bytes>> + Send + Unpin,
//             E: FromServerFnError,
//         {
//             peek(
//                 buffered,
//                 BitcodeHeader::size(),
//                 |chunk_size: &[u8]| parse_header(chunk_size)
//             ).await
//         }

//         async fn take_chunk<S, E>(buffered: &mut Buffered<S>, chunk_size: usize) -> Result<Option<BytesMut>, E>
//         where
//             S: Stream<Item = Result<Bytes, Bytes>> + Send + Unpin,
//             E: FromServerFnError,
//         {
//             take(
//                 buffered,
//                 chunk_size,
//                 |chunk: BytesMut| -> Result<BytesMut, E> {
//                     if chunk.len() >= chunk_size {
//                         Ok(chunk)
//                     } else {
//                         Err(E::from_server_fn_error(
//                             ServerFnErrorErr::Deserialization(
//                                 "The stream ended before streaming an entire chunk!".to_string()
//                             )
//                         ))
//                     }
//                 }
//             ).await
//         }

//         let byte_stream = pin! { res.try_into_stream()? };
//         let mut buffered = Buffered::new(byte_stream);

//         loop {
//             let Some(remaining) = take_header(&mut buffered).await? else {
//                 break;
//             };

//             let Some(chunk) = take_chunk(&mut buffered, remaining).await? else {
//                 break;
//             };

//             if chunk.len() == BitcodeHeader::max_chunk_size() {
//                 let Some(remaining) = take_header(&mut buffered).await? else {
//                     break;
//                 };

//                 if remaining == 0 {
//                     // Handle end-of-stream marker
//                 }
//             }

//             break;
//         }

//         todo!()
//     }
// }

// pub struct BitcodeStreamWrapper<S>(S);

// impl<E, S, Request, T> IntoReq<StreamingBitcode, Request, E> for BitcodeStreamWrapper<S>
// where
//     Request: ClientReq<E>,
//     S: Stream<Item = T> + Send + 'static,
//     E: FromServerFnError,
//     T: Serialize + 'static,
// {
//     fn into_req(self, path: &str, accepts: &str) -> Result<Request, E> {
//         let data: BitcodeStream<T> = self.0.into();
//         Request::try_new_post_streaming(
//             path,
//             accepts,
//             Streaming::CONTENT_TYPE,
//             data.0
//                 .map(|chunk| serialize(&chunk).unwrap_or_else(|_| vec![]).into()),
//         )
//     }
// }

// impl<E, T, S, Request> FromReq<StreamingBitcode, Request, E> for BitcodeStreamWrapper<S>
// where
//     Request: Req<E> + Send + 'static,
//     // The additional `Stream<Item = T>` bound is never used, but it is required to avoid an error where `T` is unconstrained
//     S: Stream<Item = T> + From<BitcodeStream<T, E>> + Send + 'static,
//     T: DeserializeOwned + 'static,
//     E: FromServerFnError,
// {
//     async fn from_req(req: Request) -> Result<Self, E> {
//         let data = req.try_into_stream()?;
//         let s = BitcodeStream::new(data.map(|chunk| match chunk {
//             Ok(bytes) => {
//                 let de = deserialize::<T>(bytes.as_ref()).map_err(|e| {
//                     E::from_server_fn_error(ServerFnErrorErr::Deserialization(e.to_string()))
//                 })?;
//                 Ok(de)
//             }
//             Err(bytes) => Err(E::de(bytes)),
//         }));
//         Ok(BitcodeStreamWrapper(s.into()))
//     }
// }
