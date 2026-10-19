# Design and assets

The user supplied **“FOODIO | Food Ordering app | Case Study — Mohammed Redowan”** as the visual reference. Its green-and-white theme, menu browsing, basket, checkout, address, order-tracking, and review flows informed this implementation.

The application is a new responsive web implementation; it is not an exact pixel reproduction and is not affiliated with the case-study author. The reference screenshot is not redistributed in this project.

All eight food illustrations in `public/images/` and `public/favicon.svg` are original code-generated SVG artwork created for this deliverable. They are not photographs of the sample dishes. Their editable generator is `scripts/make-assets.py`; Python is needed only if you choose to regenerate artwork, not to run the app.

The images are deliberately bundled so a local installation does not rely on hotlinked food photos, remote fonts, or image APIs. You can replace them with your own licensed dish photography by extending the catalog's image validation and local assets.

Icons use the `lucide-react` package under its upstream license. Application dependencies retain their own licenses, available in their npm packages. The project uses system fonts; no commercial font file is bundled.

Restaurant names, catalog entries, prices, demo identities, and addresses are sample data for testing and customization. They do not describe connected real merchants or real deliveries.
