pub mod stream;

use bytes::{Bytes, BytesMut};
use leptos::prelude::{FromServerFnError, ServerFnErrorErr};
use leptos::server_fn::codec::{Encoding, FromReq, FromRes, IntoReq, IntoRes, Streaming};

use leptos::server_fn::response::{ClientRes, TryRes};
use leptos::server_fn::ContentType;
use leptos::server_fn::{
    error::ServerFnError,
    request::{ClientReq, Req},
};

use futures_util::{Stream, StreamExt};
use http::Method;
use num_traits::ops::bytes::NumBytes;
use num_traits::ToBytes;
use num_traits::{ops::bytes::FromBytes, Bounded, Unsigned};
use std::array::TryFromSliceError;
use std::pin::{pin, Pin};

use bitcode::{deserialize, serialize};
use serde::{de::DeserializeOwned, Serialize};
use std::fmt::{Debug, Formatter, Result as FmtResult};

pub struct StreamingBitcode;

impl ContentType for StreamingBitcode {
    const CONTENT_TYPE: &'static str = "application/octet-stream";
}

impl Encoding for StreamingBitcode {
    const METHOD: Method = Method::POST;
}

pub struct BitcodeStream<T, E = ServerFnError>(Pin<Box<dyn Stream<Item = Result<T, E>> + Send>>);

impl<T, E> BitcodeStream<T, E> {
    pub fn into_inner(self) -> impl Stream<Item = Result<T, E>> + Send {
        self.0
    }
}

impl<T, E> Debug for BitcodeStream<T, E> {
    fn fmt(&self, f: &mut Formatter<'_>) -> FmtResult {
        f.debug_tuple("BitcodeStream").finish()
    }
}

trait Header: Sized {
    type Bytes: NumBytes + ?Sized;
    type FromFrameSizeError;

    fn max_chunk_size() -> usize;
    fn size() -> usize;
    fn from_bytes(bytes: &Self::Bytes) -> Self;
    fn to_bytes(&self) -> Self::Bytes;
    fn from_chunk_length(length: usize) -> Result<Self, Self::FromFrameSizeError>;
}

impl<T> Header for T
where
    T: Unsigned + Bounded + Into<usize> + FromBytes + ToBytes + TryFrom<usize>,
    T: FromBytes<Bytes = <T as ToBytes>::Bytes>,
    <T as FromBytes>::Bytes: Sized,
{
    type Bytes = <Self as FromBytes>::Bytes;
    type FromFrameSizeError = <Self as TryFrom<usize>>::Error;

    fn max_chunk_size() -> usize {
        T::max_value().into()
    }

    fn size() -> usize {
        size_of::<Self>()
    }

    fn from_bytes(bytes: &Self::Bytes) -> Self {
        Self::from_le_bytes(bytes)
    }

    fn to_bytes(&self) -> Self::Bytes {
        self.to_le_bytes()
    }

    fn from_chunk_length(length: usize) -> Result<Self, Self::FromFrameSizeError> {
        TryFrom::try_from(length)
    }
}

trait FramedStream {
    type Header: Header;
}

impl<T, E> FramedStream for BitcodeStream<T, E> {
    type Header = u16;
}

type BitcodeHeader = <BitcodeStream<(), ()> as FramedStream>::Header;

impl<T, E> BitcodeStream<T, E> {
    pub fn new(value: impl Stream<Item = Result<T, E>> + Send + 'static) -> Self {
        Self(Box::pin(value))
    }
}

impl<S, T: 'static, E: 'static> From<S> for BitcodeStream<T, E>
where
    S: Stream<Item = T> + Send + 'static,
{
    fn from(value: S) -> Self {
        Self(Box::pin(value.map(Ok)))
    }
}

pub struct Chunks<I> {
    chunk_size: usize,
    iter: I,
}

impl<I: Iterator> Iterator for Chunks<I> {
    type Item = Vec<I::Item>;

    fn next(&mut self) -> Option<Self::Item> {
        // [chunk_size] will never be zero! See the implementation of [into_chunks].
        let chunk: Vec<_> = self.iter.by_ref().take(self.chunk_size).collect();
        if chunk.is_empty() { None } else { Some(chunk) }
    }
}

pub trait ChunkExt: Iterator + Sized {
    fn into_chunks(self, chunk_size: usize) -> Chunks<Self>;
}

impl<I: Iterator> ChunkExt for I {
    fn into_chunks(self, chunk_size: usize) -> Chunks<Self> {
        if chunk_size == 0 {
            panic!("[chunk_size] can't be 0!");
        }

        Chunks {
            iter: self,
            chunk_size,
        }
    }
}

impl<E, T, Response> IntoRes<StreamingBitcode, Response, E> for BitcodeStream<T, E>
where
    Response: TryRes<E>,
    E: FromServerFnError,
    T: Serialize + 'static,
{
    async fn into_res(self) -> Result<Response, E> {
        Response::try_from_stream(
            Streaming::CONTENT_TYPE,
            self.into_inner().map(|value| {
                let serialized = serialize(&value
                    .expect(
                        "[value] should never be [Err]! See the [From] [Stream] to [BitcodeStream] trait.")
                    )
                    .map_err(|e| {
                    E::from_server_fn_error(ServerFnErrorErr::Serialization(e.to_string())).ser()
                })?;

                let max_chunk_size = BitcodeHeader::max_chunk_size();

                let serialized_byte_count = serialized.len();

                Ok(Bytes::from_iter(
                    serialized
                        .into_iter()
                        .into_chunks(max_chunk_size)
                        .flat_map(
                            |chunk| 
                                BitcodeHeader::
                                    from_chunk_length(chunk.len())
                                    .expect("Each chunk should have a maximum length of [BitcodeHeader::frame_size()]!")
                                    .to_bytes()
                                    .into_iter()
                                    .chain(chunk.into_iter())
                        )
                        .chain(if serialized_byte_count % max_chunk_size == 0 {
                            BitcodeHeader::from(0u16).to_be_bytes().to_vec()
                        } else {
                            vec![]
                        }),
                ))
            }),
        )

        // Response::try_from_stream(
        //     Streaming::CONTENT_TYPE,
        //     self.into_inner().map(move |value| {
        //         serialize(&value.map_err(|e| e.ser())?)
        //             .map(Bytes::from)
        //             .map_err(|e| {
        //                 E::from_server_fn_error(ServerFnErrorErr::Serialization(e.to_string()))
        //                     .ser()
        //             })
        //     }),
        // )
    }
}

struct Buffered<S> {
    stream: S,
    buffer: BytesMut,
}

impl<S: Stream<Item = Result<Bytes, Bytes>> + Send + Unpin> Buffered<S> {
    fn new(stream: S) -> Self {
        Buffered {
            stream,
            buffer: BytesMut::new(),
        }
    }

    async fn take(&mut self, chunk_size: usize) -> Result<Option<BytesMut>, Bytes> {
        Ok(match self.stream_in(chunk_size).await? {
            true => {
                let buffer = &mut self.buffer;
                Some(buffer.split_to(chunk_size.min(buffer.len())))
            }
            false => None,
        })
    }
    
    async fn take_peek(&mut self, chunk_size: usize) -> Result<Option<&[u8]>, Bytes> {
        Ok(match self.stream_in(chunk_size).await? {
            true => {
                let buffer = &mut self.buffer;
                Some(&buffer[..chunk_size.min(buffer.len())])
            }
            false => None,
        })
    }

    // Returns a bool that's true if there's available data and false otherwise.
    async fn stream_in(&mut self, chunk_size: usize) -> Result<bool, Bytes> {
        let buffer = &mut self.buffer;
        
        while buffer.len() < chunk_size {
            match self.stream.next().await {
                Some(Ok(chunk)) => buffer.extend(chunk),
                Some(Err(error)) => return Err(error),
                None => {
                    if buffer.is_empty() {
                        return Ok(false);
                    }

                    return Ok(true)
                }
            }
        }
        
        Ok(true)
    }
}

impl<E, T, Response> FromRes<StreamingBitcode, Response, E> for BitcodeStream<T, E>
where
    Response: ClientRes<E> + Send,
    T: DeserializeOwned,
    E: FromServerFnError,
{
    async fn from_res(res: Response) -> Result<Self, E> {
        let byte_stream = pin! { res.try_into_stream()? };
        let mut buffered = Buffered::new(byte_stream);

        let a = async move || {
            let buffer = BytesMut::new();

            let take = move |size: usize| buffered.

            loop {
                let remaining = match 
                    buffered.take(BitcodeHeader::size()).await
                    .map_err(
                        |bytes_error| E::de(bytes_error)
                    )? {
                    Some(chunk_size) => BitcodeHeader::from_bytes(
                        chunk_size
                            .as_ref()
                            .try_into()
                            .map_err(
                                |err: TryFromSliceError| {
                                    E::from_server_fn_error(ServerFnErrorErr::Deserialization("The stream ended before streaming an entire header!".to_string()))
                                }
                            )?
                    ),
                    None => {
                        break;
                    }
                }.into();

                let chunk = match buffered.take(remaining).await? {
                    Some(chunk) => if chunk.len() < remaining {
                            Err(
                                E::from_server_fn_error(
                                    ServerFnErrorErr::Deserialization("The stream ended before streaming an entire chunk!".to_string())
                                )
                            )?;
                            return todo!();
                        } else {
                            chunk
                        },
                    None => {
                        break;
                    }
                };

                if chunk.len() == BitcodeHeader::max_chunk_size() 
                {
                   let remaining = match 
                        buffered.take(BitcodeHeader::size()).await
                        .map_err(
                            |bytes_error| E::de(bytes_error)
                        )? {
                        Some(chunk_size) => BitcodeHeader::from_bytes(
                            chunk_size
                                .as_ref()
                                .try_into()
                                .map_err(
                                    |err: TryFromSliceError| {
                                        E::from_server_fn_error(ServerFnErrorErr::Deserialization("The stream ended before streaming an entire header!".to_string()))
                                    }
                                )?
                        ),
                        None => {
                            break;
                        }
                    }.into();

                    if remaining == 0 {

                    }
                }
            }
        };


        todo!()
        // let mut buffer = vec![];
        // let mut complete = true;

        // let mut remaining = 0;

        // loop {
        //     let header_size: usize = BitcodeHeader::size();

        //     let remaining: usize = match buffered.take(header_size).await? {
        //         Some(frame_size) => BitcodeHeader::from_bytes(
        //             frame_size
        //                 .as_ref()
        //                 .try_into()?
        //         ),
        //         None => {
        //             return todo!();
        //         }
        //     }.into();

        //     let frame = match buffered.take(remaining).await? {
        //         Some(frame) => {
        //             if frame.len() < remaining {
        //                 todo!()
        //             }
        //         },
        //         None => {
        //             return todo!();
        //         }
        //     };

        //     if buffer.is_empty() {
        //         let _ = deserialize(&frame);
        //         return todo!();
        //     }
        // }

        // let mut deserialized = vec![];

        // let mut buffer = vec![];
        // let mut remaining = 0;

        // while let Some(maybe_chunk) = byte_stream.next().await {
        //     match maybe_chunk {
        //         Ok(chunk) => {
        //             let chunk_length = chunk.len();
        //             let mut walker = chunk.into_iter().enumerate();

        //             for (i, byte) in walker {
        //                 if remaining == 0 {
        //                     remaining = byte as usize;
        //                     continue;
        //                 }

        //                 const CHUNK_SIZE: usize = BitcodeStream::<(), ()>::CHUNK_BODY_SIZE;

        //                 if remaining == CHUNK_SIZE {}

        //                 // let maybe_serialized_start = i + 1;

        //                 // if chunk_length - maybe_serialized_start >= remaining
        //                 //     && remaining < CHUNK_SIZE
        //                 // {
        //                 //     deserialized.push(deserialize::<T>(
        //                 //         &chunk[maybe_serialized_start
        //                 //             ..(maybe_serialized_start + remaining)],
        //                 //     ));
        //                 // }
        //             }
        //         }
        //         Err(error) => {}
        //     }
        // }
        // stream! {
        // };

        // Ok(BitcodeStream(Box::pin(stream.flat_map(|chunk| match chunk {
        //     Ok(bytes) => {
        //         let walker = bytes.into_iter();

        //         let elements = vec![];
        //         let buffer = vec![];

        //         while let Some(byte) = walker.next() {
        //             const CHUNK_SIZE: u8 = BitcodeStream::<(), ()>::CHUNK_BODY_SIZE;

        //             let frame =
        //         }

        //         let de = deserialize(bytes.as_ref()).map_err(|e| {
        //             E::from_server_fn_error(ServerFnErrorErr::Deserialization(e.to_string()))
        //         })?;
        //         Ok(de)
        //     }
        //     Err(bytes) => Err(E::de(bytes)),
        // }))))

        // let stream = res.try_into_stream()?;
        // Ok(BitcodeStream(Box::pin(stream.map(
        //     move |chunk| match chunk {
        //         Ok(bytes) => {
        //             let de = deserialize(bytes.as_ref()).map_err(|e| {
        //                 E::from_server_fn_error(ServerFnErrorErr::Deserialization(e.to_string()))
        //             })?;
        //             Ok(de)
        //         }
        //         Err(bytes) => Err(E::de(bytes)),
        //     },
        // ))))
    }
}

pub struct BitcodeStreamWrapper<S>(S);

impl<E, S, Request, T> IntoReq<StreamingBitcode, Request, E> for BitcodeStreamWrapper<S>
where
    Request: ClientReq<E>,
    S: Stream<Item = T> + Send + 'static,
    E: FromServerFnError,
    T: Serialize + 'static,
{
    fn into_req(self, path: &str, accepts: &str) -> Result<Request, E> {
        let data: BitcodeStream<T> = self.0.into();
        Request::try_new_post_streaming(
            path,
            accepts,
            Streaming::CONTENT_TYPE,
            data.0
                .map(|chunk| serialize(&chunk).unwrap_or_else(|_| vec![]).into()),
        )
    }
}

impl<E, T, S, Request> FromReq<StreamingBitcode, Request, E> for BitcodeStreamWrapper<S>
where
    Request: Req<E> + Send + 'static,
    // The additional `Stream<Item = T>` bound is never used, but it is required to avoid an error where `T` is unconstrained
    S: Stream<Item = T> + From<BitcodeStream<T, E>> + Send + 'static,
    T: DeserializeOwned + 'static,
    E: FromServerFnError,
{
    async fn from_req(req: Request) -> Result<Self, E> {
        let data = req.try_into_stream()?;
        let s = BitcodeStream::new(data.map(|chunk| match chunk {
            Ok(bytes) => {
                let de = deserialize::<T>(bytes.as_ref()).map_err(|e| {
                    E::from_server_fn_error(ServerFnErrorErr::Deserialization(e.to_string()))
                })?;
                Ok(de)
            }
            Err(bytes) => Err(E::de(bytes)),
        }));
        Ok(BitcodeStreamWrapper(s.into()))
    }
}
