use cfg_if::cfg_if;

cfg_if! {
if #[cfg(feature = "ssr")] {

use std::io::Result;

use actix_files::{Files, NamedFile};
use actix_web::{
    main as actix_main,
    get,
    App,
    HttpServer,
    Result as ActixResult,
    web::Data as WebData,
};

use leptos_actix::{generate_route_list, LeptosRoutes};

use leptos::config::{get_configuration, LeptosOptions};
use leptos::prelude::{view, ElementChild, GlobalAttributes, AutoReload, HydrationScripts};
use leptos_meta::MetaTags;

use realtime_housefest::app::*;

#[actix_main]
async fn main() -> Result<()> {
    let conf = get_configuration(None).expect("Failed to get the Leptos configuration!");
    let addr = conf.leptos_options.site_addr;

    let app_state = WebData::new(AppState::new());

    HttpServer::new(move || {
        let routes = generate_route_list(App);
        let leptos_options = &conf.leptos_options;
        let site_root = leptos_options.site_root.clone().to_string();

        // Don't remove this! This indicates that the server has reloaded.
        println!("listening on http://{}", &addr);

        App::new()
            /* Leptos puts the built website at [target/site/pkg]
               so we have to serve this directory. */
            .service(Files::new("/pkg", format!("{site_root}/pkg")))
            /* Leptos copies the files under [assets-dir] to [target/site] (aka [site_root])
               so we serve files under [site_root] under the [assets] web path. */
            .service(Files::new("/assets", &site_root))
            /* Any [favicon.ico] file served at the root of the site is used automatically as
               the website icon. Everything in [assets-dir] gets copied to [site_root], so we serve
               it from there. See [async fn favicon] and [https://www.w3schools.com/html/html_favicon.asp] */
            .service(favicon)
            .leptos_routes(routes, {
                let leptos_options = leptos_options.clone();
                move || {
                    view! {
                        <!DOCTYPE html>
                        <html lang="en">
                            <head>
                                <meta charset="utf-8"/>
                                <meta name="viewport" content="width=device-width, initial-scale=1"/>
                                <AutoReload options=leptos_options.clone() />
                                <HydrationScripts options=leptos_options.clone()/>
                                <MetaTags/>
                            </head>
                            <body>
                                <App/>
                            </body>
                        </html>
                    }
                }
            })
            .app_data(WebData::new(leptos_options.to_owned()))
            .app_data(WebData::clone(&app_state))
        //.wrap(middleware::Compress::default())
    })
    .bind(&addr)?
    .run()
    .await
}

#[get("favicon.ico")]
async fn favicon(
    leptos_options: WebData<LeptosOptions>,
) -> ActixResult<NamedFile> {
    let leptos_options = leptos_options.into_inner();
    let site_root = &leptos_options.site_root;

    Ok(NamedFile::open(format!(
        "{site_root}/favicon.ico"
    ))?)
}

}
}

#[cfg(not(any(feature = "ssr", feature = "csr")))]
pub fn main() {
    // no client-side main function
    // unless we want this to work with e.g., Trunk for pure client-side testing
    // see lib.rs for hydration function instead
    // see optional feature `csr` instead
}

#[cfg(all(not(feature = "ssr"), feature = "csr"))]
pub fn main() {
    // a client-side main function is required for using `trunk serve`
    // prefer using `cargo leptos serve` instead
    // to run: `trunk serve --open --features csr`
    use realtime_housefest::app::*;

    console_error_panic_hook::set_once();

    leptos::mount::mount_to_body(App);
}
