import { profile } from '../../data/profile';

export function Footer() {
  return (
    <footer className="footer">
      <p className="footer__credit">
        © {new Date().getFullYear()} {profile.fullName}. All Rights Reserved.
      </p>
    </footer>
  );
}
