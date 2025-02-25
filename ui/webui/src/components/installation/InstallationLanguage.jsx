/*
 * Copyright (C) 2022 Red Hat, Inc.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation; either version 2.1 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with This program; If not, see <http://www.gnu.org/licenses/>.
 */

import React, { useEffect, useState } from "react";
import cockpit from "cockpit";

import {
    Form, FormGroup,
    SelectGroup, SelectOption, Select, SelectVariant,
    Title,
} from "@patternfly/react-core";

import { AddressContext } from "../Common.jsx";

import { getLanguages, getLanguageData, getLocales, getLocaleData } from "../../apis/localization.js";

const _ = cockpit.gettext;

const getLanguageEnglishName = lang => lang["english-name"].v;
const getLanguageId = lang => lang["language-id"].v;
const getLanguageNativeName = lang => lang["native-name"].v;
const getLocaleId = locale => locale["locale-id"].v;
const getLocaleNativeName = locale => locale["native-name"].v;

class LanguageSelector extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            languages: [],
            locales: [],
        };
        this.updateDefaultSelection = this.updateDefaultSelection.bind(this);
    }

    componentDidMount () {
        getLanguages().then(ret => {
            const languages = ret;
            // Create the languages state object
            Promise.all(languages.map(lang => getLanguageData({ lang })))
                    .then(langs => this.setState({ languages: langs }));

            // Create the locales state object
            Promise.all(languages.map(lang => getLocales({ lang })))
                    .then(res => {
                        return Promise.all(
                            res.map(langLocales => {
                                return Promise.all(langLocales.map(locale =>
                                    getLocaleData({ locale })
                                ));
                            })
                        );
                    })
                    .then(res => this.setState({ locales: res }, this.updateDefaultSelection));
        });
    }

    updateDefaultSelection () {
        const languageId = this.props.lang.split("_")[0];
        const currentLangLocales = this.state.locales.find(langLocales => getLanguageId(langLocales[0]) === languageId);
        const currentLocale = currentLangLocales.find(locale => getLocaleId(locale) === this.props.lang);

        this.setState({ selectedItem: getLocaleNativeName(currentLocale) });
    }

    render () {
        const { isOpen, languages, locales, selectedItem } = this.state;
        const handleOnSelect = (_, lang) => {
            this.props.onSelectLang(lang.localeId);
            this.setState({ selectedItem: lang });
        };

        const isLoading = languages.length !== locales.length;
        const options = (
            !isLoading
                ? locales.map(langLocales => {
                    const currentLang = languages.find(lang => getLanguageId(lang) === getLanguageId(langLocales[0]));

                    return (
                        <SelectGroup
                          label={cockpit.format("$0 ($1)", getLanguageNativeName(currentLang), getLanguageEnglishName(currentLang))}
                          key={getLanguageId(currentLang)}>
                            {langLocales.map(locale => (
                                <SelectOption
                                  id={getLocaleId(locale).split(".UTF-8")[0]}
                                  key={getLocaleId(locale)}
                                  value={{
                                      toString: () => getLocaleNativeName(locale),
                                      // Add a compareTo for custom filtering - filter also by english name
                                      localeId: getLocaleId(locale)
                                  }}
                                />
                            ))}
                        </SelectGroup>
                    );
                })
                : []
        );

        return (
            <Select
              className="language-menu"
              isGrouped
              isOpen={isOpen}
              maxHeight="30rem"
              onClear={() => this.setState({ selectedItem: null })}
              onSelect={handleOnSelect}
              onToggle={isOpen => this.setState({ isOpen })}
              selections={selectedItem}
              toggleId="language-menu-toggle"
              variant={SelectVariant.typeahead}
              width="30rem"
              {...(isLoading && { loadingVariant: "spinner" })}

            >
                {options}
            </Select>
        );
    }
}
LanguageSelector.contextType = AddressContext;

export const InstallationLanguage = ({ onSelectLang }) => {
    const langCookie = (window.localStorage.getItem("cockpit.lang") || "en-us").split("-");
    const [lang, setLang] = useState(langCookie[0] + "_" + langCookie[1].toUpperCase() + ".UTF-8");

    useEffect(() => {
        if (!lang) {
            return;
        }

        /*
         * FIXME: Anaconda API returns en_US, de_DE etc, cockpit expects en-us, de-de etc
         * Make sure to check if this is generalized enough to keep so.
         */
        const cockpitLang = lang.split(".UTF-8")[0].replace(/_/g, "-").toLowerCase();
        const cookie = "CockpitLang=" + encodeURIComponent(cockpitLang) + "; path=/; expires=Sun, 16 Jul 3567 06:23:41 GMT";

        document.cookie = cookie;
        window.localStorage.setItem("cockpit.lang", cockpitLang);
    }, [lang]);

    useEffect(() => {
        return () => window.location.reload(true);
    }, [lang]);

    return (
        <Form>
            <Title headingLevel="h2" size="1xl">
                WELCOME TO FEDORA...
            </Title>
            <FormGroup label={_("What language would you like to use during the installation process?")}>
                <LanguageSelector lang={lang} onSelectLang={setLang} menuAppendTo={document.body} />
            </FormGroup>
        </Form>
    );
};
