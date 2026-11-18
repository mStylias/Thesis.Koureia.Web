<#import "template.ftl" as layout>
<@layout.emailLayout preheader=msg("passwordResetPreheader")>
<#--
  Composed from single-purpose keys, not Keycloak's `passwordResetBodyHtml`, which is one blob of
  markup inside a properties file. A designer must not edit a translation string to change
  structure, and a translator must not receive `<p>` tags.

  Keycloak owns `link` and formats `linkExpirationFormatter(linkExpiration)`, so the expiry takes
  the plural form of the reader's language.
-->
<#--
  `link` carries no language, so the page it opens falls back to the browser and answers a Greek
  mail with an English form. `kc_locale` is what a `login-actions` URL reads for it.

  The language comes from the bundle rather than from FreeMarker's `.lang`, which reports the
  server default and not the language Keycloak resolved for this message — it put an English link
  in the Greek mail. `localeCode` is whatever the bundle in use declares, so it cannot disagree.
-->
<#assign localizedLink = link + "&kc_locale=" + msg("localeCode")>
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
  <tr>
    <td style="font-family:Alegreya,Georgia,'Times New Roman',serif; font-size:26px; line-height:32px; font-weight:700; color:#1c1814; padding:0 0 16px;">
      ${msg("passwordResetHeading")}
    </td>
  </tr>
  <tr>
    <td style="font-family:'Alegreya Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:16px; line-height:26px; color:#5a4f43; padding:0 0 28px;">
      ${msg("passwordResetLead", realmName)}
    </td>
  </tr>

  <#-- Bulletproof button: the color sits on the `<td>`, so Outlook on Windows paints a solid
       rectangle even though it drops `border-radius`. The padded anchor makes the whole block
       the click target. -->
  <tr>
    <td class="kc-button" style="padding:0 0 28px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" bgcolor="#9e5f28" style="background-color:#9e5f28; border-radius:10px;">
            <a href="${localizedLink}" target="_blank" rel="noopener" style="display:inline-block; padding:14px 28px; font-family:'Alegreya Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:16px; line-height:20px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:10px;">
              ${msg("passwordResetCta")}
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="font-family:'Alegreya Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:14px; line-height:22px; color:#6f6355; padding:0 0 24px;">
      ${msg("passwordResetExpiry", linkExpirationFormatter(linkExpiration))}
    </td>
  </tr>

  <#-- The address in full, for a client that strips the anchor and for a reader who checks a
       link first. `word-break` because the token widens the table on a phone. -->
  <tr>
    <td style="font-family:'Alegreya Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:13px; line-height:20px; color:#6f6355; background-color:#fbf1e8; border-radius:10px; padding:16px; word-break:break-all;">
      ${msg("passwordResetFallback")}<br />
      <a href="${localizedLink}" target="_blank" rel="noopener" style="color:#915724; text-decoration:underline;">${localizedLink}</a>
    </td>
  </tr>

  <tr>
    <td style="font-family:'Alegreya Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:14px; line-height:22px; color:#5a4f43; padding:24px 0 0;">
      ${msg("passwordResetIgnore")}
    </td>
  </tr>
</table>
</@layout.emailLayout>
