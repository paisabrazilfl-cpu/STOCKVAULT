import { useState } from "react";
import { useCreateBrokerAccount } from "@workspace/api-client-react";
import type { BrokerAccountApplication } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

function Text({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground uppercase">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-8 text-sm" />
    </div>
  );
}

/**
 * KYC onboarding form — submits POST /broker/accounts to open the signed-in
 * user's own Alpaca brokerage account (Broker API).
 */
export function BrokerOnboarding() {
  const qc = useQueryClient();
  const { toast } = useToast();

  // Contact
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postal, setPostal] = useState("");
  // Identity
  const [given, setGiven] = useState("");
  const [family, setFamily] = useState("");
  const [dob, setDob] = useState("");
  const [taxId, setTaxId] = useState("");
  // Disclosures
  const [controlPerson, setControlPerson] = useState(false);
  const [affiliated, setAffiliated] = useState(false);
  const [pep, setPep] = useState(false);
  const [familyExposed, setFamilyExposed] = useState(false);
  // Agreement
  const [agreed, setAgreed] = useState(false);

  const { mutate, isPending } = useCreateBrokerAccount({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/broker/accounts/me"] });
        toast({ title: "Application submitted", description: "Your brokerage account is being reviewed." });
      },
      onError: (err: any) => {
        toast({
          title: "Could not submit application",
          description: err?.message ?? "Please check your details and try again.",
          variant: "destructive",
        });
      },
    },
  });

  const required = [email, phone, street, city, state, postal, given, family, dob, taxId];
  const canSubmit = agreed && required.every((v) => v.trim().length > 0);

  function handleSubmit() {
    const application: BrokerAccountApplication = {
      contact: {
        emailAddress: email,
        phoneNumber: phone,
        streetAddress: [street],
        city,
        state,
        postalCode: postal,
      },
      identity: {
        givenName: given,
        familyName: family,
        dateOfBirth: dob,
        taxId,
        taxIdType: "USA_SSN",
        countryOfCitizenship: "USA",
        countryOfBirth: "USA",
        countryOfTaxResidence: "USA",
        fundingSource: ["employment_income"],
      },
      disclosures: {
        isControlPerson: controlPerson,
        isAffiliatedExchangeOrFinra: affiliated,
        isPoliticallyExposed: pep,
        immediateFamilyExposed: familyExposed,
      },
      agreedToCustomerAgreement: agreed,
    };
    mutate({ data: application });
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Open your brokerage account</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Each user trades through their own Alpaca brokerage account. Complete this
          one-time KYC application to get started.
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Contact</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Text label="Email" value={email} onChange={setEmail} placeholder="you@example.com" />
          <Text label="Phone" value={phone} onChange={setPhone} placeholder="+1 555 555 5555" />
          <div className="col-span-2"><Text label="Street address" value={street} onChange={setStreet} placeholder="20 N San Mateo Dr" /></div>
          <Text label="City" value={city} onChange={setCity} />
          <Text label="State" value={state} onChange={setState} placeholder="CA" />
          <Text label="Postal code" value={postal} onChange={setPostal} placeholder="94401" />
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Identity</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Text label="Given name" value={given} onChange={setGiven} />
          <Text label="Family name" value={family} onChange={setFamily} />
          <Text label="Date of birth" value={dob} onChange={setDob} placeholder="YYYY-MM-DD" />
          <Text label="Tax ID (SSN)" value={taxId} onChange={setTaxId} placeholder="666-55-4321" />
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Disclosures</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {([
            ["I am a control person of a publicly traded company", controlPerson, setControlPerson],
            ["I am affiliated with an exchange or FINRA", affiliated, setAffiliated],
            ["I am a politically exposed person", pep, setPep],
            ["An immediate family member is politically exposed", familyExposed, setFamilyExposed],
          ] as [string, boolean, (v: boolean) => void][]).map(([label, val, set]) => (
            <label key={label} className="flex items-center gap-3 text-sm cursor-pointer">
              <Checkbox checked={val} onCheckedChange={(c) => set(Boolean(c))} />
              {label}
            </label>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="pt-6 space-y-4">
          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <Checkbox checked={agreed} onCheckedChange={(c) => setAgreed(Boolean(c))} className="mt-0.5" />
            <span>
              I have read and agree to the Alpaca{" "}
              <a href="https://alpaca.markets/disclosures" target="_blank" rel="noopener noreferrer" className="underline">
                Customer Agreement
              </a>.
            </span>
          </label>
          <Button onClick={handleSubmit} disabled={!canSubmit || isPending} className="w-full">
            {isPending ? "Submitting..." : "Submit application"}
          </Button>
          {!canSubmit && (
            <p className="text-xs text-muted-foreground">
              Fill in all fields and accept the customer agreement to continue.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
